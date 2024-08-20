/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable unicorn/no-null */
/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, test } from "bun:test";
import { serve } from "./serve";
import {
  driveWorkflow,
  getRequest,
  MOCK_QSTASH_SERVER_URL,
  mockQstashServer,
  WORKFLOW_ENDPOINT,
} from "./test-utils";
import { nanoid } from "nanoid";
import { Client } from "../client";
import type { FinishCondition, RouteFunction, Step, WorkflowServeOptions } from "./types";
import {
  WORKFLOW_ID_HEADER,
  WORKFLOW_INIT_HEADER,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";

const someWork = (input: string) => {
  return `processed '${input}'`;
};

const workflowRunId = `wfr${nanoid()}`;
const token = nanoid();

const qstashClient = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });

describe("serve", () => {
  test("should send create workflow request in initial request", async () => {
    const endpoint = serve<string>(
      async (context) => {
        const _input = context.requestPayload;
        await context.sleep("sleep 1", 1);
      },
      {
        qstashClient,
        verbose: true,
        receiver: undefined,
      }
    );

    const initialPayload = nanoid();
    const request = new Request(WORKFLOW_ENDPOINT, { method: "POST", body: initialPayload });
    await mockQstashServer({
      execute: async () => {
        await endpoint(request);
      },
      responseFields: { body: "msgId", status: 200 },
      receivesRequest: {
        method: "POST",
        url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/${WORKFLOW_ENDPOINT}`,
        token,
        body: initialPayload,
        headers: {
          [WORKFLOW_INIT_HEADER]: "true",
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: null,
          [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: "1",
        },
      },
    });
  });

  test("path endpoint", async () => {
    const endpoint = serve<string>(
      async (context) => {
        const input = context.requestPayload;

        const result1 = await context.run("step1", async () => {
          return someWork(input);
        });

        await context.run("step2", async () => {
          const result = someWork(result1);
          return result;
        });
      },
      {
        qstashClient,
        verbose: true,
        receiver: undefined,
      }
    );

    const initialPayload = "initial-payload";
    const steps: Step[] = [
      {
        stepId: 1,
        stepName: "step1",
        stepType: "Run",
        out: `processed '${initialPayload}'`,
        concurrent: 1,
      },
      {
        stepId: 2,
        stepName: "step2",
        stepType: "Run",
        out: `processed 'processed '${initialPayload}''`,
        concurrent: 1,
      },
    ];

    await driveWorkflow({
      execute: async (initialPayload, steps) => {
        const request = getRequest(WORKFLOW_ENDPOINT, workflowRunId, initialPayload, steps);
        await endpoint(request);
      },
      initialPayload,
      iterations: [
        {
          stepsToAdd: [],
          responseFields: { body: { messageId: "some-message-id" }, status: 200 },
          receivesRequest: {
            method: "POST",
            url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
            token,
            body: [
              {
                body: JSON.stringify(steps[0]),
                destination: WORKFLOW_ENDPOINT,
                headers: {
                  "content-type": "application/json",
                  "upstash-forward-upstash-workflow-sdk-version": "1",
                  "upstash-method": "POST",
                  "upstash-workflow-runid": workflowRunId,
                  "upstash-workflow-init": "false",
                  "upstash-workflow-url": WORKFLOW_ENDPOINT,
                },
              },
            ],
          },
        },
        {
          stepsToAdd: [steps[0]],
          responseFields: { body: { messageId: "some-message-id" }, status: 200 },
          receivesRequest: {
            method: "POST",
            url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
            token,
            body: [
              {
                destination: WORKFLOW_ENDPOINT,
                headers: {
                  "content-type": "application/json",
                  "upstash-forward-upstash-workflow-sdk-version": "1",
                  "upstash-method": "POST",
                  "upstash-workflow-runid": workflowRunId,
                  "upstash-workflow-init": "false",
                  "upstash-workflow-url": WORKFLOW_ENDPOINT,
                },
                body: JSON.stringify(steps[1]),
              },
            ],
          },
        },
        {
          stepsToAdd: [steps[1]],
          responseFields: { body: "msgId", status: 200 },
          receivesRequest: {
            method: "DELETE",
            url: `${MOCK_QSTASH_SERVER_URL}/v2/workflows/runs/${workflowRunId}?cancel=false`,
            token,
            body: undefined,
          },
        },
      ],
    });
  });

  test("should return 500 on error during step execution", async () => {
    const endpoint = serve(
      async (context) => {
        await context.run("wrong step", async () => {
          throw new Error("some-error");
        });
      },
      {
        qstashClient,
        receiver: undefined,
      }
    );

    const request = getRequest(WORKFLOW_ENDPOINT, "wfr-bar", "my-payload", []);
    let called = false;
    await mockQstashServer({
      execute: async () => {
        // endpoint will throw an error, which will result in a 500 response
        // when used as an actual endpoint
        const throws = endpoint(request);
        expect(throws).rejects.toThrow("some-error");
        called = true;
      },
      responseFields: { body: { messageId: "some-message-id" }, status: 200 },
      receivesRequest: false,
    });
    expect(called).toBeTrue();
  });

  test("should call onFinish with auth-fail if authentication fails", async () => {
    const endpoint = serve(
      async (_context) => {
        // we call `return` when auth fails:
        return;
      },
      {
        qstashClient,
        receiver: undefined,
      }
    );

    const request = getRequest(WORKFLOW_ENDPOINT, "wfr-foo", "my-payload", []);
    let called = false;
    await mockQstashServer({
      execute: async () => {
        const response = await endpoint(request);
        const { workflowRunId, finishCondition } = (await response.json()) as {
          workflowRunId: string;
          finishCondition: FinishCondition;
        };
        expect(workflowRunId).toBe("no-workflow-id");
        expect(finishCondition).toBe("auth-fail");
        called = true;
      },
      responseFields: { body: { messageId: "some-message-id" }, status: 200 },
      receivesRequest: false,
    });
    expect(called).toBeTrue();
  });

  describe("duplicate checks", () => {
    const endpoint = serve(
      async (context) => {
        const result1 = await context.run("step 1", async () => {
          return await Promise.resolve("result 1");
        });
        const result2 = await context.run("step 2", async () => {
          return await Promise.resolve("result 2");
        });
        await context.run("step 3", async () => {
          return await Promise.resolve(`combined results: ${[result1, result2]}`);
        });
      },
      {
        qstashClient,
        receiver: undefined,
      }
    );

    test("should return without doing anything when the last step is duplicate", async () => {
      // prettier-ignore
      const stepsWithDuplicate: Step[] = [
        {stepId: 1, stepName: "step 1", stepType: "Run", out: "result 1", concurrent: 1},
        {stepId: 2, stepName: "step 2", stepType: "Run", out: "result 2", concurrent: 1},
        {stepId: 2, stepName: "step 2", stepType: "Run", out: "result 2", concurrent: 1}, // duplicate
      ]
      const request = getRequest(WORKFLOW_ENDPOINT, "wfr-foo", "my-payload", stepsWithDuplicate);
      let called = false;
      await mockQstashServer({
        execute: async () => {
          const response = await endpoint(request);
          const { workflowRunId, finishCondition } = (await response.json()) as {
            workflowRunId: string;
            finishCondition: FinishCondition;
          };
          expect(workflowRunId).toBe("no-workflow-id");
          expect(finishCondition).toBe("duplicate-step");
          called = true;
        },
        responseFields: { body: { messageId: "some-message-id" }, status: 200 },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });

    test("should remove duplicate middle step and continue executing", async () => {
      // prettier-ignore
      const stepsWithDuplicate: Step[] = [
        {stepId: 1, stepName: "step 1", stepType: "Run", out: "result 1", concurrent: 1},
        {stepId: 1, stepName: "step 1", stepType: "Run", out: "result 1", concurrent: 1}, // duplicate
        {stepId: 2, stepName: "step 2", stepType: "Run", out: "result 2", concurrent: 1}, 
      ]
      const request = getRequest(WORKFLOW_ENDPOINT, "wfr-foo", "my-payload", stepsWithDuplicate);
      let called = false;
      await mockQstashServer({
        execute: async () => {
          const response = await endpoint(request);
          const { workflowRunId, finishCondition } = (await response.json()) as {
            workflowRunId: string;
            finishCondition: FinishCondition;
          };
          expect(workflowRunId).toBe("wfr-foo");
          expect(finishCondition).toBe("success");
          called = true;
        },
        responseFields: { body: { messageId: "some-message-id" }, status: 200 },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
          token,
          body: [
            {
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-init": "false",
                "upstash-workflow-runid": "wfr-foo",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
              body: '{"stepId":3,"stepName":"step 3","stepType":"Run","out":"combined results: result 1,result 2","concurrent":1}',
            },
          ],
        },
      });
      expect(called).toBeTrue();
    });
  });

  describe("failure settings", () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const routeFunction: RouteFunction<unknown> = async (context) => {
      await context.sleep("sleep-step", 1);
    };

    test("should not have failureUrl if failureUrl or failureFunction is not passed", async () => {
      const request = getRequest(WORKFLOW_ENDPOINT, "wfr-bar", "my-payload", []);
      const endpoint = serve(routeFunction, {
        qstashClient,
        receiver: undefined,
      });
      let called = false;
      await mockQstashServer({
        execute: async () => {
          await endpoint(request);
          called = true;
        },
        responseFields: { body: { messageId: "some-message-id" }, status: 200 },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
          token,
          body: [
            {
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-delay": "1s",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-init": "false",
                "upstash-workflow-runid": "wfr-bar",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
              body: '{"stepId":1,"stepName":"sleep-step","stepType":"SleepFor","sleepFor":1,"concurrent":1}',
            },
          ],
        },
      });
      expect(called).toBeTrue();
    });

    test("should set failureUrl if failureUrl is passed", async () => {
      const request = getRequest(WORKFLOW_ENDPOINT, "wfr-bar", "my-payload", []);
      const myFailureEndpoint = "https://www.my-failure-endpoint.com/api";
      const endpoint = serve(routeFunction, {
        qstashClient,
        receiver: undefined,
        failureUrl: myFailureEndpoint,
      });
      let called = false;
      await mockQstashServer({
        execute: async () => {
          await endpoint(request);
          called = true;
        },
        responseFields: { body: { messageId: "some-message-id" }, status: 200 },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
          token,
          body: [
            {
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-delay": "1s",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-init": "false",
                "upstash-workflow-runid": "wfr-bar",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
                "upstash-failure-callback": myFailureEndpoint,
                "upstash-failure-callback-forward-upstash-workflow-is-failure": "true",
              },
              body: '{"stepId":1,"stepName":"sleep-step","stepType":"SleepFor","sleepFor":1,"concurrent":1}',
            },
          ],
        },
      });
      expect(called).toBeTrue();
    });

    test("should set failureUrl as context url if failureFunction is passed", async () => {
      const request = getRequest(WORKFLOW_ENDPOINT, "wfr-bar", "my-payload", []);
      let called = false;
      const myFailureFunction: WorkflowServeOptions["failureFunction"] = async (
        _status,
        _header,
        _body
        // eslint-disable-next-line unicorn/consistent-function-scoping
      ) => {
        return;
      };
      const endpoint = serve(routeFunction, {
        qstashClient,
        receiver: undefined,
        failureFunction: myFailureFunction,
      });
      await mockQstashServer({
        execute: async () => {
          await endpoint(request);
          called = true;
        },
        responseFields: { body: { messageId: "some-message-id" }, status: 200 },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
          token,
          body: [
            {
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-delay": "1s",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-init": "false",
                "upstash-workflow-runid": "wfr-bar",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
                "upstash-failure-callback": WORKFLOW_ENDPOINT,
                "upstash-failure-callback-forward-upstash-workflow-is-failure": "true",
              },
              body: '{"stepId":1,"stepName":"sleep-step","stepType":"SleepFor","sleepFor":1,"concurrent":1}',
            },
          ],
        },
      });
      expect(called).toBeTrue();
    });
  });

  describe("should replace baseUrl correctly", () => {
    const testBaseUrl = async (
      requestUrl: string,
      baseUrl: string,
      contextUrl: string,
      url?: string
    ) => {
      const request = new Request(requestUrl, {
        headers: {
          [WORKFLOW_INIT_HEADER]: "false",
          [WORKFLOW_ID_HEADER]: "wfr-id",
        },
      });
      let called = false;
      const endpoint = serve(
        async (context) => {
          expect(context.url).toBe(contextUrl);
          called = true;
        },
        {
          url,
          baseUrl,
          qstashClient,
          receiver: undefined,
        }
      );
      await endpoint(request);
      expect(called).toBeTrue();
    };

    test("should replace localhost correctly", async () => {
      await testBaseUrl(
        "http://localhost:3000/api/path",
        "http://www.local-tunnel.com",
        "http://www.local-tunnel.com/api/path"
      );

      await testBaseUrl(
        "https://localhost:3000/api/path",
        "http://www.local-tunnel.com",
        "http://www.local-tunnel.com/api/path"
      );

      await testBaseUrl(
        "http://localhost:8080/api/path",
        "http://www.local-tunnel.com",
        "http://www.local-tunnel.com/api/path"
      );
    });

    test("should replace other url correctly", async () => {
      await testBaseUrl(
        "http://www.my-endpoint.com.it/api/path",
        "http://www.local-tunnel.com.gov.uk",
        "http://www.local-tunnel.com.gov.uk/api/path"
      );
    });
  });
});
