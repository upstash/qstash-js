/* eslint-disable @typescript-eslint/no-magic-numbers */
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
    const stepFunction = () => {
      return result;
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
        concurrent: 9,
      };

      expect(await step.getResultStep(9, stepId)).toEqual(resultStep);
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
      expect(await step.getResultStep(6, stepId)).toEqual({
        stepId,
        stepName,
        stepType: "SleepFor",
        sleepFor: sleepAmount, // adding sleepFor
        concurrent: 6,
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
      expect(await step.getResultStep(4, stepId)).toEqual({
        stepId,
        stepName,
        stepType: "SleepUntil",
        sleepUntil: sleepUntilTime, // adding sleepUntil
        concurrent: 4,
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
      expect(await step.getResultStep(4, stepId)).toEqual({
        callBody,
        callHeaders,
        callMethod,
        callUrl,
        concurrent: 4,
        stepId,
        stepName,
        stepType: "Call",
      });
    });
  });
});
