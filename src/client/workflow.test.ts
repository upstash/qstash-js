/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, test, expect } from "bun:test";
import { triggerFirstInvocation } from "./workflow/workflow-requests";
import { WorkflowContext } from "./workflow/context";
import { nanoid } from "nanoid";
import { Client } from "./client";
import { QstashError } from "./error";

describe("workflow tests", () => {
  const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });
  test("should delete workflow succesfully", async () => {
    const workflowRunId = `wfr-${nanoid()}`;
    const result = await triggerFirstInvocation(
      new WorkflowContext({
        qstashClient,
        workflowRunId,
        headers: new Headers({}) as Headers,
        steps: [],
        url: "https://some-url.com",
        initialPayload: undefined,
      })
    );
    expect(result.isOk()).toBeTrue();

    const cancelResult = await qstashClient.workflow.cancel(workflowRunId);
    expect(cancelResult).toBeTrue();

    const throws = qstashClient.workflow.cancel(workflowRunId);
    expect(throws).rejects.toThrow(
      new QstashError(`{"error":"workflowRun ${workflowRunId} not found"}`)
    );
  });
});
