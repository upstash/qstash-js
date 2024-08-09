/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect } from "bun:test";
import { MOCK_QSTASH_SERVER_URL, mockQstashServer, WORKFLOW_ENDPOINT } from "./test-utils";
import { WorkflowContext } from "./context";
import { Client } from "../client";
import { nanoid } from "nanoid";
import { QstashWorkflowError } from "../error";

describe("context tests", () => {
  const token = nanoid();
  const client = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });
  test("should raise when there are nested steps (with run)", () => {
    const context = new WorkflowContext({
      client,
      initialPayload: "my-payload",
      steps: [],
      url: WORKFLOW_ENDPOINT,
      headers: new Headers() as Headers,
      workflowRunId: "wfr-id",
    });

    const throws = async () => {
      await context.run("outer step", async () => {
        await context.run("inner step", async () => {
          return await Promise.resolve("result");
        });
      });
    };
    expect(throws).toThrow(
      new QstashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner step' inside 'outer step'"
      )
    );
  });

  test("should raise when there are nested steps (with sleep)", () => {
    const context = new WorkflowContext({
      client,
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
      new QstashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner sleep' inside 'outer step'"
      )
    );
  });

  test("should raise when there are nested steps (with sleepUntil)", () => {
    const context = new WorkflowContext({
      client,
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
      new QstashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner sleepUntil' inside 'outer step'"
      )
    );
  });

  test("should raise when there are nested steps (with call)", () => {
    const context = new WorkflowContext({
      client,
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
      new QstashWorkflowError(
        "A step can not be run inside another step. Tried to run 'inner call' inside 'outer step'"
      )
    );
  });

  test("should not raise when there are no nested steps", async () => {
    const context = new WorkflowContext({
      client,
      initialPayload: "my-payload",
      steps: [],
      url: WORKFLOW_ENDPOINT,
      headers: new Headers() as Headers,
      workflowRunId: "wfr-id",
    });

    await mockQstashServer({
      // eslint-disable-next-line @typescript-eslint/require-await
      execute: async () => {
        const throws = () =>
          context.run("my-step", async () => {
            return await Promise.resolve("my-result");
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
            body: '{"stepId":1,"stepName":"my-step","stepType":"Run","out":"my-result","concurrent":1,"targetStep":0}',
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
