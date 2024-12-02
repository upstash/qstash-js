/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, test, expect } from "bun:test";
import { triggerFirstInvocation } from "./workflow/workflow-requests";
import { WorkflowContext } from "./workflow/context";
import { nanoid } from "nanoid";
import { Client } from "./client";

describe("workflow tests", () => {
  const qstashClient = new Client({ token: process.env.QSTASH_TOKEN!, retry: false });
  test("should delete workflow succesfully", async () => {
    const workflowRunId = `wfr-${nanoid()}`;
    const result = await triggerFirstInvocation(
      new WorkflowContext({
        qstashClient,
        workflowRunId,
        headers: new Headers({}) as Headers,
        steps: [],
        url: "https://requestcatcher.com",
        initialPayload: undefined,
      }),
      3
    );
    expect(result.isOk()).toBeTrue();

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const cancelResult = await qstashClient.workflow.cancel(workflowRunId);
    expect(cancelResult).toBeTrue();
  });
});
