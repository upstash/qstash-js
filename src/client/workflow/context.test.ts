/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect } from "bun:test";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer, WORKFLOW_ENDPOINT } from "./test-utils";
import { DisabledWorkflowContext, WorkflowContext } from "./context";
import { Client } from "../client";
import { nanoid } from "nanoid";
import { QStashWorkflowAbort, QStashWorkflowError } from "../error";
import type { RouteFunction } from "./types";

describe("context tests", () => {
  const token = nanoid();
  const qstashClient = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });
  test("should raise when there are nested steps (with run)", () => {
    const context = new WorkflowContext({
      qstashClient,
      initialPayload: "my-payload",
      steps: [],
      url: WORKFLOW_ENDPOINT,
      headers: new Headers() as Headers,
      workflowRunId: "wfr-id",
    });

    const throws = async () => {
      await context.run("outer step", async () => {
        await context.run("inner step", () => {
          return "result";
        });
      });
    };
    expect(throws).toThrow(
      new QStashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner step' inside 'outer step'"
      )
    );
  });

  test("should raise when there are nested steps (with sleep)", () => {
    const context = new WorkflowContext({
      qstashClient,
      initialPayload: "my-payload",
      steps: [],
      url: WORKFLOW_ENDPOINT,
      headers: new Headers() as Headers,
      workflowRunId: "wfr-id",
    });

    const throws = async () => {
      await context.run("outer step", async () => {
        await context.sleep("inner sleep", 2);
      });
    };
    expect(throws).toThrow(
      new QStashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner sleep' inside 'outer step'"
      )
    );
  });

  test("should raise when there are nested steps (with sleepUntil)", () => {
    const context = new WorkflowContext({
      qstashClient,
      initialPayload: "my-payload",
      steps: [],
      url: WORKFLOW_ENDPOINT,
      headers: new Headers() as Headers,
      workflowRunId: "wfr-id",
    });

    const throws = async () => {
      await context.run("outer step", async () => {
        await context.sleepUntil("inner sleepUntil", 2);
      });
    };
    expect(throws).toThrow(
      new QStashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner sleepUntil' inside 'outer step'"
      )
    );
  });

  test("should raise when there are nested steps (with call)", () => {
    const context = new WorkflowContext({
      qstashClient,
      initialPayload: "my-payload",
      steps: [],
      url: WORKFLOW_ENDPOINT,
      headers: new Headers() as Headers,
      workflowRunId: "wfr-id",
    });

    const throws = async () => {
      await context.run("outer step", async () => {
        await context.call("inner call", "https://some-url.com", "GET");
      });
    };
    expect(throws).toThrow(
      new QStashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner call' inside 'outer step'"
      )
    );
  });

  test("should not raise when there are no nested steps", async () => {
    const context = new WorkflowContext({
      qstashClient,
      initialPayload: "my-payload",
      steps: [],
      url: WORKFLOW_ENDPOINT,
      headers: new Headers() as Headers,
      workflowRunId: "wfr-id",
    });

    await mockQStashServer({
      execute: () => {
        const throws = () =>
          context.run("my-step", () => {
            return "my-result";
          });
        expect(throws).toThrowError("Aborting workflow after executing step 'my-step'.");
      },
      responseFields: {
        status: 200,
        body: "msgId",
      },
      receivesRequest: {
        method: "POST",
        url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
        token,
        body: [
          {
            body: '{"stepId":1,"stepName":"my-step","stepType":"Run","out":"my-result","concurrent":1}',
            destination: WORKFLOW_ENDPOINT,
            headers: {
              "content-type": "application/json",
              "upstash-forward-upstash-workflow-sdk-version": "1",
              "upstash-method": "POST",
              "upstash-workflow-init": "false",
              "upstash-workflow-runid": "wfr-id",
              "upstash-workflow-url": WORKFLOW_ENDPOINT,
            },
          },
        ],
      },
    });
  });
});

describe("disabled workflow context", () => {
  const token = nanoid();
  const qstashClient = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });
  const disabledContext = new DisabledWorkflowContext({
    qstashClient,
    workflowRunId: "wfr-foo",
    headers: new Headers() as Headers,
    steps: [],
    url: WORKFLOW_ENDPOINT,
    initialPayload: "my-payload",
  });
  describe("should throw abort for each step kind", () => {
    test("run", async () => {
      let called = false;
      await mockQStashServer({
        execute: () => {
          const throws = disabledContext.run("run-step", () => {
            return 1;
          });
          expect(throws).rejects.toThrow(QStashWorkflowAbort);
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });
    test("sleep", async () => {
      let called = false;
      await mockQStashServer({
        execute: () => {
          const throws = disabledContext.sleep("sleep-step", 1);
          expect(throws).rejects.toThrow(QStashWorkflowAbort);
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });
    test("run", async () => {
      let called = false;
      await mockQStashServer({
        execute: () => {
          const throws = disabledContext.sleepUntil("sleepUntil-step", 1);
          expect(throws).rejects.toThrow(QStashWorkflowAbort);
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });
    test("run", async () => {
      let called = false;
      await mockQStashServer({
        execute: () => {
          const throws = disabledContext.call("call-step", "some-url", "GET");
          expect(throws).rejects.toThrow(QStashWorkflowAbort);
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });
  });

  describe("tryAuthentication", () => {
    const disabledContext = new DisabledWorkflowContext({
      qstashClient,
      workflowRunId: "wfr-foo",
      headers: new Headers() as Headers,
      steps: [],
      url: WORKFLOW_ENDPOINT,
      initialPayload: "my-payload",
    });

    test("should return step-found on step", async () => {
      const endpoint: RouteFunction<string> = async (context) => {
        await context.sleep("sleep-step", 1);
      };

      let called = false;
      await mockQStashServer({
        execute: async () => {
          const result = await DisabledWorkflowContext.tryAuthentication(endpoint, disabledContext);
          expect(result.isOk()).toBeTrue();
          expect(result.isOk() && result.value).toBe("step-found");
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });

    test("should return run-ended on return", async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const endpoint: RouteFunction<string> = async (_context) => {
        return;
      };

      let called = false;
      await mockQStashServer({
        execute: async () => {
          const result = await DisabledWorkflowContext.tryAuthentication(endpoint, disabledContext);
          expect(result.isOk()).toBeTrue();
          expect(result.isOk() && result.value).toBe("run-ended");
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });

    test("should get error on error", async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const endpoint: RouteFunction<string> = async (_context) => {
        throw new Error("my-error");
      };

      let called = false;
      await mockQStashServer({
        execute: async () => {
          const result = await DisabledWorkflowContext.tryAuthentication(endpoint, disabledContext);
          expect(result.isErr()).toBeTrue();
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });
      expect(called).toBeTrue();
    });
  });

  describe("async/sync run method handling", () => {
    test("should await Promise in async method", async () => {
      const context = new WorkflowContext({
        qstashClient,
        workflowRunId: "wfr-bar",
        headers: new Headers() as Headers,
        steps: [],
        url: WORKFLOW_ENDPOINT,
        initialPayload: "my-payload",
      });

      let called = false;
      await mockQStashServer({
        execute: () => {
          const throws = context.run("step", async () => {
            return await Promise.resolve("result");
          });
          expect(throws).rejects.toThrowError(QStashWorkflowAbort);
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
          token,
          body: [
            {
              body: '{"stepId":1,"stepName":"step","stepType":"Run","out":"result","concurrent":1}',
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-init": "false",
                "upstash-workflow-runid": "wfr-bar",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
            },
          ],
        },
      });
      expect(called).toBeTrue();
    });

    test("should await Promise in sync method", async () => {
      const context = new WorkflowContext({
        qstashClient,
        workflowRunId: "wfr-bar",
        headers: new Headers() as Headers,
        steps: [],
        url: WORKFLOW_ENDPOINT,
        initialPayload: "my-payload",
      });

      let called = false;
      await mockQStashServer({
        execute: () => {
          const throws = context.run("step", () => {
            return Promise.resolve("result");
          });
          expect(throws).rejects.toThrowError(QStashWorkflowAbort);
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
          token,
          body: [
            {
              body: '{"stepId":1,"stepName":"step","stepType":"Run","out":"result","concurrent":1}',
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-init": "false",
                "upstash-workflow-runid": "wfr-bar",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
            },
          ],
        },
      });
      expect(called).toBeTrue();
    });

    test("should return non-Promise in sync method as it is", async () => {
      const context = new WorkflowContext({
        qstashClient,
        workflowRunId: "wfr-bar",
        headers: new Headers() as Headers,
        steps: [],
        url: WORKFLOW_ENDPOINT,
        initialPayload: "my-payload",
      });

      let called = false;
      await mockQStashServer({
        execute: () => {
          const throws = context.run("step", () => {
            return "result";
          });
          expect(throws).rejects.toThrowError(QStashWorkflowAbort);
          called = true;
          called = true;
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
          token,
          body: [
            {
              body: '{"stepId":1,"stepName":"step","stepType":"Run","out":"result","concurrent":1}',
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-init": "false",
                "upstash-workflow-runid": "wfr-bar",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
            },
          ],
        },
      });
      expect(called).toBeTrue();
    });
  });
});
