import { describe, expect, test } from "bun:test";
import { serve } from "bun";
import { nanoid } from "nanoid";

import {
  getHeaders,
  handleThirdPartyCallResult,
  recreateUserHeaders,
  triggerRouteFunction,
  triggerWorkflowDelete,
} from "./workflow-requests";
import { QstashWorkflowAbort } from "../error";
import { WorkflowContext } from "./context";
import { Client } from "../client";
import type { Step, StepType } from "./types";
import {
  WORKFLOW_ID_HEADER,
  WORKFLOW_INIT_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";

const MOCK_SERVER_PORT = 8080;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;
const WORKFLOW_ENDPOINT = "https://www.my-website.com/api";
/**
 * Create a HTTP client to mock QStash. We pass the URL of the mock server
 * as baseUrl and verify that the request is as we expect.
 *
 * @param execute function which will call QStash
 * @param responseBody response returned from QStash
 * @param responseStatus response status returned from QStash
 * @param requestFields fields of the request sent to QStash as a result of running
 *    `await execute()`.
 */
const mockQstashServer = async ({
  execute,
  responseBody,
  responseStatus,
  requestFields,
}: {
  execute: () => Promise<unknown>;
  responseBody: unknown;
  responseStatus: number;
  requestFields?: {
    method: string;
    url: string;
    token: string;
    body?: unknown;
  };
}) => {
  const shouldBeCalled = Boolean(requestFields);
  let called = false;

  const server = serve({
    async fetch(request) {
      called = true;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { method, url, token, body } = requestFields!;
      try {
        expect(request.method).toBe(method);
        expect(request.url).toBe(url);
        expect(request.headers.get("authorization")).toBe(`Bearer ${token}`);
        if (body) {
          expect(await request.json()).toEqual(body);
        }
      } catch (error) {
        if (error instanceof Error) {
          return new Response(JSON.stringify(error, Object.getOwnPropertyNames(error)), {
            status: 400,
          });
        }
      }
      return new Response(JSON.stringify(responseBody), { status: responseStatus });
    },
    port: MOCK_SERVER_PORT,
  });

  try {
    await execute();
    expect(called).toBe(shouldBeCalled);
  } finally {
    server.stop(true);
  }
};

describe("Workflow Requests", () => {
  describe("triggerRouteFunction", () => {
    test("test step finish", async () => {
      const result = await triggerRouteFunction({
        onStep: () => {
          throw new QstashWorkflowAbort("name");
        },
        onCleanup: async () => {
          await Promise.resolve();
        },
      });
      expect(result.isOk()).toBeTrue();
      // @ts-expect-error value will be set since stepFinish isOk
      expect(result.value).toBe("step-finished");
    });

    test("test workflow finish", async () => {
      const result = await triggerRouteFunction({
        onStep: async () => {
          await Promise.resolve();
        },
        onCleanup: async () => {
          await Promise.resolve();
        },
      });
      expect(result.isOk()).toBeTrue();
      // @ts-expect-error value will be set since stepFinish isOk
      expect(result.value).toBe("workflow-finished");
    });

    test("test error in step", async () => {
      const result = await triggerRouteFunction({
        onStep: () => {
          throw new Error("Something went wrong!");
        },
        onCleanup: async () => {
          await Promise.resolve();
        },
      });
      expect(result.isErr()).toBeTrue();
    });

    test("test error in cleanup", async () => {
      const result = await triggerRouteFunction({
        onStep: async () => {
          await Promise.resolve();
        },
        onCleanup: () => {
          throw new Error("Something went wrong!");
        },
      });
      expect(result.isErr()).toBeTrue();
    });
  });

  test("triggerWorkflowDelete", async () => {
    const workflowId = nanoid();
    const token = "myToken";

    const context = new WorkflowContext({
      client: new Client({ baseUrl: MOCK_SERVER_URL, token }),
      workflowId: workflowId,
      initialPayload: undefined,
      steps: [],
      url: WORKFLOW_ENDPOINT,
    });

    await mockQstashServer({
      execute: async () => {
        await triggerWorkflowDelete(context);
      },
      responseBody: "deleted",
      responseStatus: 200,
      requestFields: {
        method: "DELETE",
        url: `${MOCK_SERVER_URL}/v2/workflows/${workflowId}?cancel=false`,
        token,
        body: undefined,
      },
    });
  });

  test("recreateUserHeaders", () => {
    const headers = new Headers();
    headers.append("Upstash-Workflow-Other-Header", "value1");
    headers.append("My-Header", "value2");

    const newHeaders = recreateUserHeaders(headers as Headers);

    // eslint-disable-next-line unicorn/no-null
    expect(newHeaders.get("Upstash-Workflow-Other-Header")).toBe(null);
    expect(newHeaders.get("My-Header")).toBe("value2");
  });

  describe("handleThirdPartyCallResult", () => {
    test("is-call-return case", async () => {
      // request parameters
      const thirdPartyCallResult = "third-party-call-result";
      const requestPayload = { status: 200, body: btoa(thirdPartyCallResult) };
      const stepName = "test step";
      const stepType: StepType = "Run";
      const workflowId = nanoid();

      // create client
      const token = "myToken";
      const client = new Client({ baseUrl: MOCK_SERVER_URL, token });

      // create the request which will be received by the serve method:
      const request = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(requestPayload),
        headers: new Headers({
          "Upstash-Workflow-Callback": "true",
          "Upstash-Workflow-StepId": "3",
          "Upstash-Workflow-StepName": stepName,
          "Upstash-Workflow-StepType": stepType,
          "Upstash-Workflow-Concurrent": "1",
          "Upstash-Workflow-ContentType": "application/json",
          [WORKFLOW_ID_HEADER]: workflowId,
        }),
      });

      // create mock server and run the code
      await mockQstashServer({
        execute: async () => {
          const result = await handleThirdPartyCallResult(request, client);
          expect(result.isOk());
          // @ts-expect-error value will be set since stepFinish isOk
          expect(result.value).toBe("is-call-return");
        },
        responseBody: { messageId: "msgId" },
        responseStatus: 200,
        requestFields: {
          method: "POST",
          url: `${MOCK_SERVER_URL}/v2/publish/${WORKFLOW_ENDPOINT}`,
          token,
          body: {
            stepId: 3,
            stepName: stepName,
            stepType: stepType,
            out: thirdPartyCallResult,
            concurrent: 1,
            targetStep: 0,
          },
        },
      });
    });

    test("call-will-retry case (no request to QStash)", async () => {
      // in this test, the SDK receives a request with "Upstash-Workflow-Callback": "true"
      // but the status is not OK, so we have to do nothing return `call-will-retry`

      // request parameters
      const thirdPartyCallResult = "third-party-call-result";

      // status set to 404 which should make QStash retry. workflow sdk should do nothing
      // in this case
      const requestPayload = { status: 404, body: btoa(thirdPartyCallResult) };
      const stepName = "test step";
      const stepType: StepType = "Run";
      const workflowId = nanoid();

      // create client
      const token = "myToken";
      const client = new Client({ baseUrl: MOCK_SERVER_URL, token });

      // create the request which will be received by the serve method:
      const request = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(requestPayload),
        headers: new Headers({
          "Upstash-Workflow-Callback": "true",
          "Upstash-Workflow-StepId": "3",
          "Upstash-Workflow-StepName": stepName,
          "Upstash-Workflow-StepType": stepType,
          "Upstash-Workflow-Concurrent": "1",
          "Upstash-Workflow-ContentType": "application/json",
          [WORKFLOW_ID_HEADER]: workflowId,
        }),
      });

      // create mock server and run the code
      await mockQstashServer({
        execute: async () => {
          const result = await handleThirdPartyCallResult(request, client);
          expect(result.isOk());
          // @ts-expect-error value will be set since stepFinish isOk
          expect(result.value).toBe("call-will-retry");
        },
        responseBody: { messageId: "msgId" },
        responseStatus: 200,
        // we pass requestFields: undefined to indicate that QStash shouldn't be called
        requestFields: undefined,
      });
    });

    test("continue-workflow case (no request to QStash)", async () => {
      // payload is a list of steps
      const initialPayload = "my-payload";
      const requestPayload: Step[] = [
        {
          stepId: 1,
          stepName: "step name",
          stepType: "Run",
          concurrent: 1,
          targetStep: 0,
        },
      ];
      const workflowId = nanoid();

      // create client
      const token = "myToken";
      const client = new Client({ baseUrl: MOCK_SERVER_URL, token });

      // create the request which will be received by the serve method:
      const initialRequest = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: initialPayload,
        headers: new Headers({}),
      });

      const workflowRequest = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: JSON.stringify([initialPayload, requestPayload]),
        headers: new Headers({
          [WORKFLOW_INIT_HEADER]: "false",
          [WORKFLOW_ID_HEADER]: workflowId,
          [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
        }),
      });

      // create mock server and run the code
      await mockQstashServer({
        execute: async () => {
          // first call
          const initialResult = await handleThirdPartyCallResult(initialRequest, client);
          expect(initialResult.isOk());
          // @ts-expect-error value will be set since stepFinish isOk
          expect(initialResult.value).toBe("continue-workflow");

          // second call
          const result = await handleThirdPartyCallResult(workflowRequest, client);
          expect(result.isOk());
          // @ts-expect-error value will be set since stepFinish isOk
          expect(result.value).toBe("continue-workflow");
        },
        responseBody: { messageId: "msgId" },
        responseStatus: 200,
        // we pass requestFields: undefined to indicate that QStash shouldn't be called
        requestFields: undefined,
      });
    });
  });

  describe("getHeaders", () => {
    const workflowId = nanoid();
    test("no step passed", () => {
      const headers = getHeaders("true", workflowId, WORKFLOW_ENDPOINT);
      expect(headers).toEqual({
        [WORKFLOW_INIT_HEADER]: "true",
        [WORKFLOW_ID_HEADER]: workflowId,
        [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
      });
    });

    test("result step passed", () => {
      const stepId = 3;
      const stepName = "some step";
      const stepType: StepType = "Run";

      const headers = getHeaders("false", workflowId, WORKFLOW_ENDPOINT, {
        stepId,
        stepName,
        stepType: stepType,
        concurrent: 1,
        targetStep: 0,
      });
      expect(headers).toEqual({
        [WORKFLOW_INIT_HEADER]: "false",
        [WORKFLOW_ID_HEADER]: workflowId,
        [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
      });
    });

    test("call step passed", () => {
      const stepId = 3;
      const stepName = "some step";
      const stepType: StepType = "Call";
      const callUrl = "https://www.some-call-endpoint.com/api";
      const callMethod = "GET";
      const callHeaders = {
        "my-custom-header": "my-custom-header-value",
      };
      const callBody = undefined;

      const headers = getHeaders("false", workflowId, WORKFLOW_ENDPOINT, {
        stepId,
        stepName,
        stepType: stepType,
        concurrent: 1,
        targetStep: 0,
        callUrl,
        callMethod,
        callHeaders,
        callBody,
      });
      expect(headers).toEqual({
        [WORKFLOW_INIT_HEADER]: "false",
        [WORKFLOW_ID_HEADER]: workflowId,
        [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,

        "Upstash-Callback": WORKFLOW_ENDPOINT,
        "Upstash-Callback-Forward-Upstash-Workflow-Callback": "true",
        "Upstash-Callback-Forward-Upstash-Workflow-Concurrent": "1",
        "Upstash-Callback-Forward-Upstash-Workflow-ContentType": "application/json",
        "Upstash-Callback-Forward-Upstash-Workflow-StepId": stepId.toString(),
        "Upstash-Callback-Forward-Upstash-Workflow-StepName": stepName,
        "Upstash-Callback-Forward-Upstash-Workflow-StepType": "Call",
        "Upstash-Callback-Workflow-CallType": "fromCallback",
        "Upstash-Callback-Workflow-Id": workflowId,
        "Upstash-Callback-Workflow-Init": "false",
        "Upstash-Forward-my-custom-header": "my-custom-header-value",
        "Upstash-Workflow-CallType": "toCallback",
      });
    });
  });
});
