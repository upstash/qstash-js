/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, test } from "bun:test";
import { getPayload, handleFailure, parseRequest, validateRequest } from "./workflow-parser";
import {
  WORKFLOW_FAILURE_HEADER,
  WORKFLOW_ID_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";
import { nanoid } from "nanoid";
import type { RawStep, Step, WorkflowServeOptions } from "./types";
import { getRequest, WORKFLOW_ENDPOINT } from "./test-utils";
import { formatWorkflowError, QStashWorkflowError } from "../error";
import { Client } from "../client";
import { processOptions } from "./serve";

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
      expect(throws).toThrow(new QStashWorkflowError("Couldn't get workflow id from header"));
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
        new QStashWorkflowError(
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

      const requestPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestPayload,
        true
      );

      // payload isn't parsed
      expect(typeof rawInitialPayload).toBe("string");
      expect(rawInitialPayload).toBe(rawPayload);
      // steps are empty:
      expect(steps).toEqual([]);
      expect(isLastDuplicate).toBeFalse();
    });

    test("should throw when not first invocation and body is missing", async () => {
      const request = new Request(WORKFLOW_ENDPOINT);

      const requestPayload = (await getPayload(request)) ?? "";
      const throws = parseRequest(requestPayload, false);
      expect(throws).rejects.toThrow(
        new QStashWorkflowError("Only first call can have an empty body")
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
        },
        {
          stepId: 2,
          stepName: "second step",
          stepType: "Run",
          out: "second result",
          concurrent: 1,
        },
      ];

      const request = getRequest(WORKFLOW_ENDPOINT, "wfr-id", requestInitialPayload, resultSteps);

      const requestPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestPayload,
        false
      );

      // payload is not parsed
      expect(typeof rawInitialPayload).toEqual("string");
      expect(rawInitialPayload).toEqual(JSON.stringify(requestInitialPayload));
      expect(isLastDuplicate).toBeFalse();

      // steps
      expect(typeof steps).toBe("object");
      const expectedSteps: Step[] = [
        {
          stepId: 0,
          stepName: "init",
          stepType: "Initial",
          out: rawInitialPayload,
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

      const requestPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestPayload,
        false
      );

      expect(rawInitialPayload).toBe(reqiestInitialPayload);

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
    };
    const workflowId = "wfr-foo";

    test("should ignore extra init steps", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 0, stepName: "init", stepType: "Initial", out: "duplicate-payload", concurrent: 1},
        {stepId: 1, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
      ])
    });

    test("target step duplicated at the end", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
      ])
    });

    test("target step duplicated in the middle", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4}, // duplicate
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
      ])
    });

    test("concurrent step result duplicated", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2},
      ])
    });

    test("concurrent step result duplicated with two results", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out: "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out: "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out: "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out: "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out: "20", concurrent: 2},
      ])
    });

    test("result step duplicate", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1}, // duplicate
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
      ])
    });

    test("duplicate results in the middle", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1}, // duplicate
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
      ])
    });

    test("all duplicated", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeTrue();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2},
      ])
    });

    test("all duplicated except last", async () => {
      // prettier-ignore
      const requestSteps: Step[] = [
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2},
      ]

      const request = getRequest(WORKFLOW_ENDPOINT, workflowId, requestPayload, requestSteps);

      const requestFromPayload = (await getPayload(request)) ?? "";
      const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
        requestFromPayload,
        false
      );

      expect(rawInitialPayload).toBe(requestPayload);
      expect(isLastDuplicate).toBeFalse();

      // prettier-ignore
      expect(steps).toEqual([
        initStep,
        {stepId: 1, stepName: "chargeStep", stepType: "Run", out:  "false", concurrent: 1},
        {stepId: 2, stepName: "retrySleep", stepType: "SleepFor", sleepFor: 1_000_000, concurrent: 1},
        {stepId: 3, stepName: "chargeStep", stepType: "Run", out:  "true", concurrent: 1},
        {stepId: 0, stepName: "successStep1", stepType: "Run", concurrent: 2, targetStep: 4},
        {stepId: 4, stepName: "successStep1", stepType: "Run", out:  "10", concurrent: 2},
        {stepId: 0, stepName: "successStep2", stepType: "Run", concurrent: 2, targetStep: 5},
        {stepId: 5, stepName: "successStep2", stepType: "Run", out:  "20", concurrent: 2},
      ])
    });
  });

  describe("handleFailure", () => {
    const client = new Client({
      baseUrl: process.env.MOCK_QSTASH_URL,
      token: process.env.MOCK_QSTASH_TOKEN ?? "",
    });
    const { initialPayloadParser } = processOptions();

    const failMessage = `my-custom-error-${nanoid()}`;
    const authorization = `Bearer ${nanoid()}`;
    const initialPayload = { hello: "world" };
    const body = {
      status: 201,
      header: { myHeader: "value" },
      body: btoa(JSON.stringify(formatWorkflowError(new QStashWorkflowError(failMessage)))),
      url: WORKFLOW_ENDPOINT,
      sourceHeader: {
        Authorization: authorization,
      },
      sourceBody: btoa(
        JSON.stringify([
          {
            callType: "step",
            messageId: "msg-id",
            body: btoa(JSON.stringify(initialPayload)),
          } as RawStep,
        ])
      ),
    };
    test("should return not-failure-callback when the header is not set", async () => {
      const request = new Request(WORKFLOW_ENDPOINT);
      const failureFunction: WorkflowServeOptions["failureFunction"] = async (
        _context,
        _failStatus,
        _failResponse
        // eslint-disable-next-line @typescript-eslint/require-await, unicorn/consistent-function-scoping
      ) => {
        return;
      };

      // no failureFunction
      const result1 = await handleFailure(request, "", client, initialPayloadParser);
      expect(result1.isOk()).toBeTrue();
      expect(result1.isOk() && result1.value === "not-failure-callback").toBeTrue();

      // with failureFunction
      const result2 = await handleFailure(
        request,
        "",
        client,
        initialPayloadParser,
        failureFunction
      );
      expect(result2.isOk()).toBeTrue();
      expect(result2.isOk() && result2.value === "not-failure-callback").toBeTrue();
    });

    test("should throw QStashWorkflowError if header is set but function is not passed", async () => {
      const request = new Request(WORKFLOW_ENDPOINT, {
        headers: {
          [WORKFLOW_FAILURE_HEADER]: "true",
        },
      });

      const result = await handleFailure(request, "", client, initialPayloadParser);
      expect(result.isErr()).toBeTrue();
      expect(result.isErr() && result.error.name).toBe(QStashWorkflowError.name);
      expect(result.isErr() && result.error.message).toBe(
        "Workflow endpoint is called to handle a failure," +
          " but a failureFunction is not provided in serve options." +
          " Either provide a failureUrl or a failureFunction."
      );
    });

    test("should return error when the failure function throws an error", async () => {
      const request = new Request(WORKFLOW_ENDPOINT, {
        body: JSON.stringify(body),
        headers: {
          [WORKFLOW_FAILURE_HEADER]: "true",
        },
      });
      const failureFunction: WorkflowServeOptions["failureFunction"] = async (
        _status,
        _header,
        _body
        // eslint-disable-next-line @typescript-eslint/require-await, unicorn/consistent-function-scoping
      ) => {
        throw new Error("my-error");
      };

      const result = await handleFailure(
        request,
        JSON.stringify(body),
        client,
        initialPayloadParser,
        failureFunction
      );
      expect(result.isErr()).toBeTrue();
      expect(result.isErr() && result.error.message).toBe("my-error");
    });

    test("should return is-failure-callback when failure code runs succesfully", async () => {
      const request = new Request(WORKFLOW_ENDPOINT, {
        body: JSON.stringify(body),
        headers: {
          [WORKFLOW_FAILURE_HEADER]: "true",
        },
      });
      const failureFunction: WorkflowServeOptions["failureFunction"] = async (
        context,
        failStatus,
        failResponse
        // eslint-disable-next-line @typescript-eslint/require-await, unicorn/consistent-function-scoping
      ) => {
        expect(failStatus).toBe(201);
        expect(failResponse).toBe(failMessage);
        expect(context.headers.get("authorization")).toBe(authorization);
        return;
      };

      const result = await handleFailure(
        request,
        JSON.stringify(body),
        client,
        initialPayloadParser,
        failureFunction
      );
      expect(result.isOk()).toBeTrue();
      expect(result.isOk() && result.value).toBe("is-failure-callback");
    });
  });
});
