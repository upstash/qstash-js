import { describe, expect, spyOn, test } from "bun:test";
import { nanoid } from "nanoid";

import {
  getHeaders,
  handleThirdPartyCallResult,
  recreateUserHeaders,
  triggerFirstInvocation,
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
  WORKFLOW_URL_HEADER,
} from "./constants";
import {
  MOCK_QSTASH_SERVER_URL,
  MOCK_SERVER_URL,
  mockQstashServer,
  WORKFLOW_ENDPOINT,
} from "./test-utils";

describe("Workflow Requests", () => {
  test("triggerFirstInvocation", async () => {
    const workflowRunId = nanoid();
    const initialPayload = nanoid();
    const token = "myToken";

    const context = new WorkflowContext({
      client: new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token }),
      workflowRunId: workflowRunId,
      initialPayload,
      headers: new Headers({}) as Headers,
      steps: [],
      url: WORKFLOW_ENDPOINT,
    });

    await mockQstashServer({
      execute: async () => {
        await triggerFirstInvocation(context);
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/https://www.my-website.com/api`,
        token,
        body: initialPayload,
      },
    });
  });

  describe("triggerRouteFunction", () => {
    test("should get step-finished when QstashWorkflowAbort is thrown", async () => {
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

    test("should get workflow-finished when no error is thrown", async () => {
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

    test("should get Err if onStep throws error", async () => {
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

    test("should get Err if onCleanup throws error", async () => {
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

  test("should call publishJSON in triggerWorkflowDelete", async () => {
    const workflowRunId = nanoid();
    const token = "myToken";

    const context = new WorkflowContext({
      client: new Client({ baseUrl: MOCK_SERVER_URL, token }),
      workflowRunId: workflowRunId,
      initialPayload: undefined,
      headers: new Headers({}) as Headers,
      steps: [],
      url: WORKFLOW_ENDPOINT,
    });

    const spy = spyOn(context.client.http, "request");
    await triggerWorkflowDelete(context);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith({
      path: ["v2", "workflows", "runs", `${workflowRunId}?cancel=false`],
      method: "DELETE",
      parseResponseAsJson: false,
    });
  });

  test("should remove workflow headers in recreateUserHeaders", () => {
    const headers = new Headers();
    headers.append("Upstash-Workflow-Other-Header", "value1");
    headers.append("My-Header", "value2");

    const newHeaders = recreateUserHeaders(headers as Headers);

    // eslint-disable-next-line unicorn/no-null
    expect(newHeaders.get("Upstash-Workflow-Other-Header")).toBe(null);
    expect(newHeaders.get("My-Header")).toBe("value2");
  });

  describe("handleThirdPartyCallResult", () => {
    test("should POST third party call results in is-call-return case", async () => {
      // request parameters
      const thirdPartyCallResult = "third-party-call-result";
      const requestPayload = { status: 200, body: btoa(thirdPartyCallResult) };
      const stepName = "test step";
      const stepType: StepType = "Run";
      const workflowRunId = nanoid();

      // create client
      const token = nanoid();
      const client = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });

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
          [WORKFLOW_ID_HEADER]: workflowRunId,
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
        responseFields: {
          body: { messageId: "msgId" },
          status: 200,
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/${WORKFLOW_ENDPOINT}`,
          token,
          body: {
            stepId: 3,
            stepName: stepName,
            stepType: stepType,
            out: thirdPartyCallResult,
            concurrent: 1,
          },
        },
      });
    });

    test("should do nothing in call-will-retry case", async () => {
      // in this test, the SDK receives a request with "Upstash-Workflow-Callback": "true"
      // but the status is not OK, so we have to do nothing return `call-will-retry`

      // request parameters
      const thirdPartyCallResult = "third-party-call-result";

      // status set to 404 which should make QStash retry. workflow sdk should do nothing
      // in this case
      const requestPayload = { status: 404, body: btoa(thirdPartyCallResult) };
      const stepName = "test step";
      const stepType: StepType = "Run";
      const workflowRunId = nanoid();

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
          [WORKFLOW_ID_HEADER]: workflowRunId,
        }),
      });

      const spy = spyOn(client, "publishJSON");
      const result = await handleThirdPartyCallResult(request, client);
      expect(result.isOk()).toBeTrue();
      // @ts-expect-error value will be set since stepFinish isOk
      expect(result.value).toBe("call-will-retry");
      expect(spy).toHaveBeenCalledTimes(0);
    });

    test("should do nothing in continue-workflow case", async () => {
      // payload is a list of steps
      const initialPayload = "my-payload";
      const requestPayload: Step[] = [
        {
          stepId: 1,
          stepName: "step name",
          stepType: "Run",
          concurrent: 1,
        },
      ];
      const workflowRunId = nanoid();

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
          [WORKFLOW_ID_HEADER]: workflowRunId,
          [WORKFLOW_URL_HEADER]: WORKFLOW_ENDPOINT,
          [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
        }),
      });

      const spy = spyOn(client, "publishJSON");
      const initialResult = await handleThirdPartyCallResult(initialRequest, client);
      expect(initialResult.isOk());
      // @ts-expect-error value will be set since stepFinish isOk
      expect(initialResult.value).toBe("continue-workflow");
      expect(spy).toHaveBeenCalledTimes(0);

      // second call
      const result = await handleThirdPartyCallResult(workflowRequest, client);
      expect(result.isOk()).toBeTrue();
      // @ts-expect-error value will be set since stepFinish isOk
      expect(result.value).toBe("continue-workflow");
      expect(spy).toHaveBeenCalledTimes(0);
    });
  });

  describe("getHeaders", () => {
    const workflowRunId = nanoid();
    test("should create headers without step passed", () => {
      const headers = getHeaders("true", workflowRunId, WORKFLOW_ENDPOINT);
      expect(headers).toEqual({
        [WORKFLOW_INIT_HEADER]: "true",
        [WORKFLOW_ID_HEADER]: workflowRunId,
        [WORKFLOW_URL_HEADER]: WORKFLOW_ENDPOINT,
        [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
      });
    });

    test("should create headers with a result step", () => {
      const stepId = 3;
      const stepName = "some step";
      const stepType: StepType = "Run";

      const headers = getHeaders("false", workflowRunId, WORKFLOW_ENDPOINT, undefined, {
        stepId,
        stepName,
        stepType: stepType,
        concurrent: 1,
      });
      expect(headers).toEqual({
        [WORKFLOW_INIT_HEADER]: "false",
        [WORKFLOW_ID_HEADER]: workflowRunId,
        [WORKFLOW_URL_HEADER]: WORKFLOW_ENDPOINT,
        [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
      });
    });

    test("should create headers with a call step", () => {
      const stepId = 3;
      const stepName = "some step";
      const stepType: StepType = "Call";
      const callUrl = "https://www.some-call-endpoint.com/api";
      const callMethod = "GET";
      const callHeaders = {
        "my-custom-header": "my-custom-header-value",
      };
      const callBody = undefined;

      const headers = getHeaders("false", workflowRunId, WORKFLOW_ENDPOINT, undefined, {
        stepId,
        stepName,
        stepType: stepType,
        concurrent: 1,
        callUrl,
        callMethod,
        callHeaders,
        callBody,
      });
      expect(headers).toEqual({
        [WORKFLOW_INIT_HEADER]: "false",
        [WORKFLOW_ID_HEADER]: workflowRunId,
        [WORKFLOW_URL_HEADER]: WORKFLOW_ENDPOINT,
        [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,

        "Upstash-Callback": WORKFLOW_ENDPOINT,
        "Upstash-Callback-Forward-Upstash-Workflow-Callback": "true",
        "Upstash-Callback-Forward-Upstash-Workflow-Concurrent": "1",
        "Upstash-Callback-Forward-Upstash-Workflow-ContentType": "application/json",
        "Upstash-Callback-Forward-Upstash-Workflow-StepId": stepId.toString(),
        "Upstash-Callback-Forward-Upstash-Workflow-StepName": stepName,
        "Upstash-Callback-Forward-Upstash-Workflow-StepType": "Call",
        "Upstash-Callback-Workflow-CallType": "fromCallback",
        "Upstash-Callback-Workflow-RunId": workflowRunId,
        "Upstash-Callback-Workflow-Init": "false",
        "Upstash-Callback-Workflow-Url": WORKFLOW_ENDPOINT,
        "Upstash-Forward-my-custom-header": "my-custom-header-value",
        "Upstash-Workflow-CallType": "toCallback",
      });
    });
  });
});
