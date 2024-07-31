import { describe, test, expect } from "bun:test";
import { LazyCallStep, LazyFunctionStep, LazySleepStep, LazySleepUntilStep } from "./steps";
import { nanoid } from "nanoid";
import type { Step } from "./types";

describe("test steps", () => {
  const stepName = nanoid();
  const concurrent = 10;
  const targetStep = 7;
  const stepId = 20;

  describe("function step", () => {
    const result = nanoid();
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const stepFunction = async () => {
      return await Promise.resolve(result);
    };
    const step = new LazyFunctionStep(stepName, stepFunction);

    test("should set correct fields", () => {
      expect(step.stepName).toBe(stepName);
      expect(step.stepType).toBe("Run");
    });
    test("should create plan step", () => {
      expect(step.getPlanStep(concurrent, targetStep)).toEqual({
        stepId: 0,
        stepName,
        stepType: "Run",
        concurrent,
        targetStep,
      });
    });

    test("should create result step", async () => {
      const resultStep: Step<string> = {
        stepId,
        stepName,
        stepType: "Run",
        out: result,
        concurrent: 1,
        targetStep: 0,
      };

      // _singleStep has no affect:
      expect(await step.getResultStep(stepId, false)).toEqual(resultStep);
      expect(await step.getResultStep(stepId, true)).toEqual(resultStep);
    });
  });

  describe("sleep step", () => {
    const sleepAmount = 123_123;
    const step = new LazySleepStep(stepName, sleepAmount);

    test("should set correct fields", () => {
      expect(step.stepName).toBe(stepName);
      expect(step.stepType).toBe("SleepFor");
    });
    test("should create plan step", () => {
      expect(step.getPlanStep(concurrent, targetStep)).toEqual({
        stepId: 0,
        stepName,
        stepType: "SleepFor",
        sleepFor: sleepAmount,
        concurrent,
        targetStep,
      });
    });

    test("should create result step", async () => {
      // if singleStep=false, then we are running parallel and the
      // sleep was applied in the sleep step.
      expect(await step.getResultStep(stepId, false)).toEqual({
        stepId,
        stepName,
        stepType: "SleepFor",
        concurrent: 1,
        targetStep: 0,
      });

      // if singleStep=true, then we should sleep
      expect(await step.getResultStep(stepId, true)).toEqual({
        stepId,
        stepName,
        stepType: "SleepFor",
        sleepFor: sleepAmount, // adding sleepFor
        concurrent: 1,
        targetStep: 0,
      });
    });
  });

  describe("sleepUntil step", () => {
    const sleepUntilTime = 123_123;
    const step = new LazySleepUntilStep(stepName, sleepUntilTime);

    test("should set correct fields", () => {
      expect(step.stepName).toBe(stepName);
      expect(step.stepType).toBe("SleepUntil");
    });
    test("should create plan step", () => {
      expect(step.getPlanStep(concurrent, targetStep)).toEqual({
        stepId: 0,
        stepName,
        stepType: "SleepUntil",
        sleepUntil: sleepUntilTime,
        concurrent,
        targetStep,
      });
    });

    test("should create result step", async () => {
      // if singleStep=false, then we are running parallel and the
      // sleep was applied in the sleep step.
      expect(await step.getResultStep(stepId, false)).toEqual({
        stepId,
        stepName,
        stepType: "SleepUntil",
        concurrent: 1,
        targetStep: 0,
      });

      // if singleStep=true, then we should sleep
      expect(await step.getResultStep(stepId, true)).toEqual({
        stepId,
        stepName,
        stepType: "SleepUntil",
        sleepUntil: sleepUntilTime, // adding sleepFor
        concurrent: 1,
        targetStep: 0,
      });
    });
  });

  describe("call step", () => {
    const headerValue = nanoid();

    const callUrl = "https://www.website.com/api";
    const callMethod = "POST";
    const callBody = nanoid();
    const callHeaders = {
      "my-header": headerValue,
    };
    const step = new LazyCallStep(stepName, callUrl, callMethod, callBody, callHeaders);

    test("should set correct fields", () => {
      expect(step.stepName).toBe(stepName);
      expect(step.stepType).toBe("Call");
    });
    test("should create plan step", () => {
      expect(step.getPlanStep(concurrent, targetStep)).toEqual({
        stepId: 0,
        stepName,
        stepType: "Call",
        concurrent,
        targetStep,
      });
    });

    test("should create result step", async () => {
      expect(await step.getResultStep(stepId)).toEqual({
        callBody,
        callHeaders,
        callMethod,
        callUrl,
        concurrent: 1,
        stepId,
        stepName,
        stepType: "Call",
        targetStep: 0,
      });
    });
  });
});
