/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, test } from "bun:test";
import { internalHeader } from "./types";
import { Workflow } from "./workflow";
import { Client } from "../client";

class SpyWorkflow extends Workflow {
  public declare client;
  public declare url;
  public declare stepCount;
  public declare workflowId;
  public declare steps;
  public declare skip;

  public declare getParallelCallState;
  static async createWorkflow(request: Request, client: Client) {
    const workflow = Workflow.createWorkflow(request, client) as unknown as SpyWorkflow;
    return await Promise.resolve(workflow);
  }
}

describe("Workflow", () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  const workflow = new SpyWorkflow({
    client,
    url: "mock",
    workflowId: "wf007",
    steps: [
      {
        stepId: 1,
        concurrent: 0,
        targetStep: 0,
      },
    ],
    skip: false,
  });

  workflow.stepCount = 1;

  // following tests should be run in the order they are written
  describe("should decide parallel step state", () => {
    test("first request", () => {
      // in this case, we are running a parallel step for the first time since
      // this.stepCount equals this.steps.length
      expect(workflow.getParallelCallState(2)).toBe("first");
    });
    test("partial request", () => {
      // in this case, we are currently running a parallel request and the last step
      // is a plan step, meaning that we will execute the corresponding step function
      workflow.steps.push({
        stepId: 0,
        concurrent: 2,
        targetStep: 2,
      });
      expect(workflow.getParallelCallState(2)).toBe("partial");
    });
    test("discarded request", () => {
      // in this case, we are currently running a parallel request and the last step
      // is NOT a plan step, meaning that we will discard the request
      workflow.steps.push({
        stepId: 2,
        out: "first result",
        concurrent: 1,
        targetStep: 0,
      });
      expect(workflow.getParallelCallState(2)).toBe("discard");
    });
    test("last request", () => {
      // in this case, all results have been received. We will return the results
      workflow.steps.push(
        {
          stepId: 0,
          concurrent: 2,
          targetStep: 3,
        },
        {
          stepId: 3,
          out: "second result",
          concurrent: 1,
          targetStep: 0,
        }
      );
      expect(workflow.getParallelCallState(2)).toBe("last");
    });
  });

  describe("should parse request", () => {
    test("initial request", async () => {
      const mockRequest = new Request("https://www.mock.com", {
        headers: {},
        body: '{"foo": "bar"}',
      });

      const workflow = await SpyWorkflow.createWorkflow(mockRequest as unknown as Request, client);

      // steps are skipped in the first run
      expect(workflow.skip).toBeTrue();

      // in initial request workflow, request payload is in out of first call
      expect(workflow.steps).toEqual([
        { stepId: 0, out: { foo: "bar" }, concurrent: 1, targetStep: 0 },
      ]);
    });

    test("other requests", async () => {
      const mockId = "wf007";
      const mockUrl = "https://www.mock.com/";
      const mockRequest = new Request(mockUrl, {
        headers: {
          [internalHeader]: "yes",
          "Upstash-Workflow-Id": mockId,
        },
        // base64 encoding of:
        // "{\"stepId\":0,\"out\":{\"foo\":\"bar\"},\"concurrent\":1,\"targetStep\":0}"
        body: '["IntcInN0ZXBJZFwiOjAsXCJvdXRcIjp7XCJmb29cIjpcImJhclwifSxcImNvbmN1cnJlbnRcIjoxLFwidGFyZ2V0U3RlcFwiOjB9Ig=="]',
      });

      const workflow = await SpyWorkflow.createWorkflow(mockRequest as unknown as Request, client);

      expect(workflow.skip).toBeFalse();
      expect(workflow.workflowId).toBe(mockId);
      expect(workflow.url).toBe(mockUrl);
      expect(workflow.steps).toEqual([
        { stepId: 0, out: { foo: "bar" }, concurrent: 1, targetStep: 0 },
      ]);

      expect(workflow.requestPayload()).toEqual({ foo: "bar" });
    });
  });
});
