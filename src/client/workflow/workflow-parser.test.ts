/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, test } from "bun:test";
import { parseRequest, validateRequest } from "./workflow-parser";
import {
  WORKFLOW_ID_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";
import { nanoid } from "nanoid";
import type { Step } from "./types";
import { getRequest, WORKFLOW_ENDPOINT } from "./test-utils";
import { QstashWorkflowError } from "../error";

describe("Workflow Parser", () => {
  describe("validateRequest", () => {
    test("should accept first invocation", () => {
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: undefined,
      });

      const { isFirstInvocation, workflowRunId } = validateRequest(request);

      expect(isFirstInvocation).toBeTrue();
      expect(workflowRunId.slice(0, 4)).toBe("wfr_");
      expect(workflowRunId.length).toBeGreaterThan(2);
    });

    test("should ignore passed workflow header if first invocation", () => {
      const requestWorkflowRunId = "wfr-some-id";
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_ID_HEADER]: requestWorkflowRunId,
        },
      });

      const { isFirstInvocation, workflowRunId } = validateRequest(request);

      expect(isFirstInvocation).toBeTrue();
      // worklfow id in the request should be ignored
      expect(workflowRunId !== requestWorkflowRunId).toBeTrue();
    });

    test("should throw when protocol header is given without workflow id header", () => {
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
        },
      });

      const throws = () => validateRequest(request);
      expect(throws).toThrow(new QstashWorkflowError("Couldn't get workflow id from header"));
    });

    test("should throw when protocol version is incompatible", () => {
      const requestProtocol = "wrong-protocol";
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: requestProtocol,
        },
      });

      const throws = () => validateRequest(request);
      expect(throws).toThrow(
        new QstashWorkflowError(
          `Incompatible workflow sdk protocol version.` +
            ` Expected ${WORKFLOW_PROTOCOL_VERSION}, got ${requestProtocol} from the request.`
        )
      );
    });

    test("should accept when called correctly", () => {
      const requestWorkflowRunId = `wfr${nanoid()}`;
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
          [WORKFLOW_ID_HEADER]: requestWorkflowRunId,
        },
      });
      const { isFirstInvocation, workflowRunId } = validateRequest(request);

      expect(isFirstInvocation).toBeFalse();
      expect(workflowRunId).toBe(requestWorkflowRunId);
    });
  });

  describe("parseRequest", () => {
    test("should handle first invocation", async () => {
      const payload = { initial: "payload" };
      const rawPayload = JSON.stringify(payload);
      const request = new Request(WORKFLOW_ENDPOINT, {
        body: rawPayload,
      });
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, true);

      // payload isn't parsed
      expect(typeof initialPayload).toBe("string");
      expect(initialPayload).toBe(rawPayload);
      // steps are empty:
      expect(steps).toEqual([]);
      expect(isLastDuplicate).toBeFalse();
    });

    test("should throw when not first invocation and body is missing", () => {
      const request = new Request(WORKFLOW_ENDPOINT);
      // isFirstInvocation = false:
      const throws = parseRequest(request, false);
      expect(throws).rejects.toThrow(
        new QstashWorkflowError("Only first call can have an empty body")
      );
    });

    test("should return steps and initial payload correctly", async () => {
      const requestInitialPayload = { initial: "payload" };
      const resultSteps: Step[] = [
        {
          stepId: 1,
          stepName: "first step",
          stepType: "Run",
          out: "first result",
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 2,
          stepName: "second step",
          stepType: "Run",
          out: "second result",
          concurrent: 1,
          targetStep: 0,
        },
      ];

      const request = getRequest(WORKFLOW_ENDPOINT, "wfr-id", requestInitialPayload, resultSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      // payload is not parsed
      expect(typeof initialPayload).toEqual("string");
      expect(initialPayload).toEqual(JSON.stringify(requestInitialPayload));
      expect(isLastDuplicate).toBeFalse();

      // steps
      expect(typeof steps).toBe("object");
      const expectedSteps: Step[] = [
        {
          stepId: 0,
          stepName: "init",
          stepType: "Initial",
          out: initialPayload,
          targetStep: 0,
          concurrent: 1,
        },
        ...resultSteps,
      ];
      expect(steps).toEqual(expectedSteps);

      // first step body (which is initial payload) is also string,
      // it's not parsed:
      expect(typeof steps[0].out).toBe("string");
    });

    test("should filter out toCallback and fromCallback", async () => {
      const reqiestInitialPayload = "initial payload";
      const remainingStepId = 3;

      const getEncodedStep: (stepId: number) => string = (stepId) => {
        return btoa(
          JSON.stringify({
            stepId,
            stepName: "step",
            stepType: "Call",
            out: "result",
            concurrent: 1,
            targetStep: 1,
          })
        );
      };
      const payload = [
        {
          messageId: "msgId",
          body: btoa(reqiestInitialPayload),
          callType: "step",
        },
        {
          messageId: "msgId",
          body: getEncodedStep(1),
          callType: "toCallback",
        },
        {
          messageId: "msgId",
          body: getEncodedStep(2),
          callType: "fromCallback",
        },
        {
          messageId: "msgId",
          body: getEncodedStep(remainingStepId),
          callType: "step",
        },
      ];

      const request = new Request(WORKFLOW_ENDPOINT, { body: JSON.stringify(payload) });
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(reqiestInitialPayload);

      expect(steps.length).toBe(2);
      expect(steps[0].stepId).toBe(0);
      expect(steps[1].stepId).toBe(remainingStepId);
      expect(isLastDuplicate).toBeFalse();
    });
  });

  describe("parseRequest with duplicates", () => {
    const requestPayload = "myPayload";
    const initStep: Step = {
      stepId: 0,
      stepName: "init",
      stepType: "Initial",
      out: requestPayload,
      concurrent: 1,
      targetStep: 0,
    };
    const workflowId = "wfr-foo";

    test("should ignore extra init steps", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 0, stepName: "init", stepType: "Initial", out: "duplicate-payload", concurrent: 1, targetStep: 0},
        {stepId: 1, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
      ])
    });

    test("target step duplicated at the end", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
      ])
    });

    test("target step duplicated in the middle", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4}, // duplicate
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
      ])
    });

    test("concurrent step result duplicated", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2, targetStep: 0},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2, targetStep: 0}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2, targetStep: 0},
      ])
    });

    test("concurrent step result duplicated with two results", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out: "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2, targetStep: 0},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2, targetStep: 0}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out: "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2, targetStep: 0},
      ])
    });

    test("result step duplicate", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
      ])
    });

    test("duplicate results in the middle", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0}, // duplicate
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
      ])
    });

    test("all duplicated", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2, targetStep: 0},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2, targetStep: 0},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2, targetStep: 0},
      ])
    });

    test("all duplicated except last", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2, targetStep: 0},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);
      const { initialPayload, steps, isLastDuplicate } = await parseRequest(request, false);

      expect(initialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1, targetStep: 0},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1, targetStep: 0},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1, targetStep: 0},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2, targetStep: 0},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2, targetStep: 0},
      ])
    });
  });
});
