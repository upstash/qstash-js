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

describe("Workflow Parser", () => {
  describe("validateRequest", () => {
    test("should accept first invocation", () => {
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: undefined,
      });

      const { isFirstInvocation, workflowId } = validateRequest(request);

      expect(isFirstInvocation).toBeTrue();
      expect(workflowId.slice(0, 2)).toBe("wf");
      expect(workflowId.length).toBeGreaterThan(2);
    });

    test("should ignore passed workflow header if first invocation", () => {
      const requestWorkflowId = "wf-some-id";
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_ID_HEADER]: requestWorkflowId,
        },
      });

      const { isFirstInvocation, workflowId } = validateRequest(request);

      expect(isFirstInvocation).toBeTrue();
      // worklfow id in the request should be ignored
      expect(workflowId !== requestWorkflowId).toBeTrue();
    });

    test("should throw when protocol header is given without workflow id header", () => {
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
        },
      });

      const throws = () => validateRequest(request);
      expect(throws).toThrow("Couldn't get workflow id from header");
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
        `Incompatible workflow sdk protocol version.` +
          ` Expected ${WORKFLOW_PROTOCOL_VERSION}, got ${requestProtocol} from the request.`
      );
    });

    test("should accept when called correctly", () => {
      const requestWorkflowId = `wf${nanoid()}`;
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
          [WORKFLOW_ID_HEADER]: requestWorkflowId,
        },
      });
      const { isFirstInvocation, workflowId } = validateRequest(request);

      expect(isFirstInvocation).toBeFalse();
      expect(workflowId).toBe(requestWorkflowId);
    });
  });

  describe("parseRequest", () => {
    test("should handle first invocation", async () => {
      const payload = { initial: "payload" };
      const rawPayload = JSON.stringify(payload);
      const request = new Request(WORKFLOW_ENDPOINT, {
        body: rawPayload,
      });
      const { initialPayload, steps } = await parseRequest(request, true);

      // payload isn't parsed
      expect(typeof initialPayload).toBe("string");
      expect(initialPayload).toBe(rawPayload);
      // steps are empty:
      expect(steps).toEqual([]);
    });

    test("should throw when not first invocation and body is missing", () => {
      const request = new Request(WORKFLOW_ENDPOINT);
      // isFirstInvocation = false:
      const throws = parseRequest(request, false);
      expect(throws).rejects.toThrow("Only first call can have an empty body");
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
          targetStep: 1,
        },
        {
          stepId: 1,
          stepName: "first step",
          stepType: "Run",
          out: "second result",
          concurrent: 1,
          targetStep: 1,
        },
      ];

      const request = getRequest(WORKFLOW_ENDPOINT, "wf-id", requestInitialPayload, resultSteps);
      const { initialPayload, steps } = await parseRequest(request, false);

      // payload is not parsed
      expect(typeof initialPayload).toEqual("string");
      expect(initialPayload).toEqual(JSON.stringify(requestInitialPayload));

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
      const { initialPayload, steps } = await parseRequest(request, false);

      expect(initialPayload).toBe(reqiestInitialPayload);

      expect(steps.length).toBe(2);
      expect(steps[0].stepId).toBe(0);
      expect(steps[1].stepId).toBe(remainingStepId);
    });
  });
});
