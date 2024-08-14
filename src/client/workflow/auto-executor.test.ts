/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, spyOn, test } from "bun:test";
import { WorkflowContext } from "./context";
import { Client } from "../client";
import { MOCK_QSTASH_SERVER_URL, mockQstashServer, WORKFLOW_ENDPOINT } from "./test-utils";
import { nanoid } from "nanoid";
import { AutoExecutor } from "./auto-executor";
import type { Step } from "./types";
import { QstashWorkflowAbort, QstashWorkflowError } from "../error";

class SpyAutoExecutor extends AutoExecutor {
  public declare getParallelCallState;
  public declare runSingle;
  public declare runParallel;
}

class SpyWorkflowContext extends WorkflowContext {
  public declare executor: SpyAutoExecutor;
}

/**
 * in these tests, we create a context by passing it
 * steps manually.
 *
 * In each test, we:
 * - create a context from `initialStep`, `singleStep` and `parallelSteps`
 * - create spies on runSingle and runParallel of the auto-executor
 * - create a mock qstash server (the server is provided the expected request body/method/headers)
 * - run single step or parallel steps in different stages of execution and check the server
 * - check how the spy was called
 */
describe("auto-executor", () => {
  const initialPayload = { initial: "payload" };
  const token = nanoid();
  const workflowRunId = nanoid();

  const initialStep: Step = {
    stepId: 0,
    stepName: "init",
    stepType: "Initial",
    out: JSON.stringify(initialPayload),
    concurrent: 1,
  };

  const singleStep: Step = {
    stepId: 1,
    stepName: "attemptCharge",
    stepType: "Run",
    out: { input: initialPayload, success: false },
    concurrent: 1,
  };

  const parallelSteps: Step[] = [
    {
      stepId: 0,
      stepName: "sleep for some time",
      stepType: "SleepFor",
      sleepFor: 123,
      concurrent: 2,
      targetStep: 1,
    },
    {
      stepId: 0,
      stepName: "sleep until next day",
      stepType: "SleepUntil",
      sleepUntil: 123_123,
      concurrent: 2,
      targetStep: 2,
    },
    {
      stepId: 1,
      stepName: "sleep for some time",
      stepType: "SleepFor",
      sleepFor: 123,
      concurrent: 2,
    },
    {
      stepId: 2,
      stepName: "sleep until next day",
      stepType: "SleepUntil",
      sleepUntil: 123_123,
      concurrent: 2,
    },
  ];

  const getContext = (steps: Step[]) => {
    return new SpyWorkflowContext({
      qstashClient: new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token }),
      workflowRunId,
      initialPayload,
      headers: new Headers({}) as Headers,
      steps,
      url: WORKFLOW_ENDPOINT,
    });
  };

  describe("single step", () => {
    test("should send a single step", async () => {
      const context = getContext([initialStep]);

      const spyRunSingle = spyOn(context.executor, "runSingle");
      const spyRunParallel = spyOn(context.executor, "runParallel");

      await mockQstashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          const throws = context.run("attemptCharge", async () => {
            return await Promise.resolve({ input: context.requestPayload, success: false });
          });
          expect(throws).rejects.toThrowError(QstashWorkflowAbort);
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
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-runid": workflowRunId,
                "upstash-workflow-init": "false",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
              body: JSON.stringify(singleStep),
            },
          ],
        },
      });

      expect(spyRunSingle).toHaveBeenCalledTimes(1);
      const lazyStep = spyRunSingle.mock.calls[0][0];
      expect(lazyStep.stepName).toBe("attemptCharge");
      expect(lazyStep.stepType).toBe("Run");

      expect(spyRunParallel).toHaveBeenCalledTimes(0);
    });

    test("should use single step result from request", async () => {
      const context = getContext([initialStep, singleStep]);

      const spyRunSingle = spyOn(context.executor, "runSingle");
      const spyRunParallel = spyOn(context.executor, "runParallel");

      await mockQstashServer({
        execute: async () => {
          expect(context.executor.stepCount).toBe(0);
          expect(context.executor.planStepCount).toBe(0);
          const result = await context.run("attemptCharge", async () => {
            return await Promise.resolve({ input: context.requestPayload, success: false });
          });
          expect(context.executor.stepCount).toBe(1);
          expect(context.executor.planStepCount).toBe(0);
          expect(result).toEqual({ input: context.requestPayload, success: false });
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });

      expect(spyRunSingle).toHaveBeenCalledTimes(1);
      const lazyStep = spyRunSingle.mock.calls[0][0];
      expect(lazyStep.stepName).toBe("attemptCharge");
      expect(lazyStep.stepType).toBe("Run");

      expect(spyRunParallel).toHaveBeenCalledTimes(0);
    });
  });

  describe("parallel steps", () => {
    test("should send plan steps in first encounter: should send plan steps as batch", async () => {
      const context = getContext([initialStep]);

      const spyRunSingle = spyOn(context.executor, "runSingle");
      const spyRunParallel = spyOn(context.executor, "runParallel");

      await mockQstashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(context.executor.getParallelCallState(2, 1)).toBe("first");
          const throws = Promise.all([
            context.sleep("sleep for some time", 123),
            context.sleepUntil("sleep until next day", 123_123),
          ]);
          expect(throws).rejects.toThrowError(QstashWorkflowAbort);
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
              body: '{"stepId":0,"stepName":"sleep for some time","stepType":"SleepFor","sleepFor":123,"concurrent":2,"targetStep":1}',
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-delay": "123s",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-runid": workflowRunId,
                "upstash-workflow-init": "false",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
            },
            {
              body: '{"stepId":0,"stepName":"sleep until next day","stepType":"SleepUntil","sleepUntil":123123,"concurrent":2,"targetStep":2}',
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-not-before": "123123",
                "upstash-workflow-runid": workflowRunId,
                "upstash-workflow-init": "false",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
            },
          ],
        },
      });

      expect(spyRunSingle).toHaveBeenCalledTimes(0);

      expect(spyRunParallel).toHaveBeenCalledTimes(1);
      const lazySteps = spyRunParallel.mock.calls[0][0];
      expect(lazySteps.length).toBe(2);
      expect(lazySteps[0].stepType).toBe("SleepFor");
      expect(lazySteps[1].stepType).toBe("SleepUntil");
      expect(lazySteps[0].stepName).toBe("sleep for some time");
      expect(lazySteps[1].stepName).toBe("sleep until next day");
    });

    test("should send plan steps in second encounter: should run the first parallel step", async () => {
      const context = getContext([initialStep, parallelSteps[0]]);

      const spyRunSingle = spyOn(context.executor, "runSingle");
      const spyRunParallel = spyOn(context.executor, "runParallel");

      await mockQstashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(context.executor.getParallelCallState(2, 1)).toBe("partial");
          const throws = Promise.all([
            context.sleep("sleep for some time", 123),
            context.sleepUntil("sleep until next day", 123_123),
          ]);
          expect(throws).rejects.toThrowError(QstashWorkflowAbort);
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
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-runid": workflowRunId,
                "upstash-workflow-init": "false",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
              body: JSON.stringify(parallelSteps[2]),
            },
          ],
        },
      });

      expect(spyRunSingle).toHaveBeenCalledTimes(0);

      expect(spyRunParallel).toHaveBeenCalledTimes(1);
      const lazySteps = spyRunParallel.mock.calls[0][0];
      expect(lazySteps.length).toBe(2);
      expect(lazySteps[0].stepType).toBe("SleepFor");
      expect(lazySteps[1].stepType).toBe("SleepUntil");
      expect(lazySteps[0].stepName).toBe("sleep for some time");
      expect(lazySteps[1].stepName).toBe("sleep until next day");
    });

    test("should send plan steps in third encounter: should run the second parallel step", async () => {
      const context = getContext([initialStep, ...parallelSteps.slice(0, 2)]);

      const spyRunSingle = spyOn(context.executor, "runSingle");
      const spyRunParallel = spyOn(context.executor, "runParallel");

      await mockQstashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(context.executor.getParallelCallState(2, 1)).toBe("partial");
          const throws = Promise.all([
            context.sleep("sleep for some time", 123),
            context.sleepUntil("sleep until next day", 123_123),
          ]);
          expect(throws).rejects.toThrowError(QstashWorkflowAbort);
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
              destination: WORKFLOW_ENDPOINT,
              headers: {
                "content-type": "application/json",
                "upstash-forward-upstash-workflow-sdk-version": "1",
                "upstash-method": "POST",
                "upstash-workflow-runid": workflowRunId,
                "upstash-workflow-init": "false",
                "upstash-workflow-url": WORKFLOW_ENDPOINT,
              },
              body: JSON.stringify(parallelSteps[3]),
            },
          ],
        },
      });

      expect(spyRunSingle).toHaveBeenCalledTimes(0);

      expect(spyRunParallel).toHaveBeenCalledTimes(1);
      const lazySteps = spyRunParallel.mock.calls[0][0];
      expect(lazySteps.length).toBe(2);
      expect(lazySteps[0].stepType).toBe("SleepFor");
      expect(lazySteps[1].stepType).toBe("SleepUntil");
      expect(lazySteps[0].stepName).toBe("sleep for some time");
      expect(lazySteps[1].stepName).toBe("sleep until next day");
    });

    test("should send plan steps in fourth encounter: should discard", async () => {
      const context = getContext([initialStep, ...parallelSteps.slice(0, 3)]);

      const spyRunSingle = spyOn(context.executor, "runSingle");
      const spyRunParallel = spyOn(context.executor, "runParallel");

      await mockQstashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(context.executor.getParallelCallState(2, 1)).toBe("discard");
          const throws = Promise.all([
            context.sleep("sleep for some time", 123),
            context.sleepUntil("sleep until next day", 123_123),
          ]);
          expect(throws).rejects.toThrowError(QstashWorkflowAbort);
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });

      expect(spyRunSingle).toHaveBeenCalledTimes(0);

      expect(spyRunParallel).toHaveBeenCalledTimes(1);
      const lazySteps = spyRunParallel.mock.calls[0][0];
      expect(lazySteps.length).toBe(2);
      expect(lazySteps[0].stepType).toBe("SleepFor");
      expect(lazySteps[1].stepType).toBe("SleepUntil");
      expect(lazySteps[0].stepName).toBe("sleep for some time");
      expect(lazySteps[1].stepName).toBe("sleep until next day");
    });

    test("should send plan steps in fifth and final encounter: should return the result", async () => {
      const context = getContext([initialStep, ...parallelSteps]);

      const spyRunSingle = spyOn(context.executor, "runSingle");
      const spyRunParallel = spyOn(context.executor, "runParallel");

      await mockQstashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(context.executor.getParallelCallState(2, 1)).toBe("last");
          expect(context.executor.stepCount).toBe(0);
          expect(context.executor.planStepCount).toBe(0);
          const result = await Promise.all([
            context.sleep("sleep for some time", 123),
            context.sleepUntil("sleep until next day", 123_123),
          ]);
          expect(result).toEqual([undefined, undefined]);
          expect(context.executor.stepCount).toBe(2);
          expect(context.executor.planStepCount).toBe(2);
          expect(context.executor.getParallelCallState(2, 3)).toBe("first");
        },
        responseFields: {
          status: 200,
          body: "msgId",
        },
        receivesRequest: false,
      });

      expect(spyRunSingle).toHaveBeenCalledTimes(0);

      expect(spyRunParallel).toHaveBeenCalledTimes(1);
      const lazySteps = spyRunParallel.mock.calls[0][0];
      expect(lazySteps.length).toBe(2);
      expect(lazySteps[0].stepType).toBe("SleepFor");
      expect(lazySteps[1].stepType).toBe("SleepUntil");
      expect(lazySteps[0].stepName).toBe("sleep for some time");
      expect(lazySteps[1].stepName).toBe("sleep until next day");
    });
  });

  describe("should throw error when step name/type changes", () => {
    describe("single step", () => {
      test("step name", () => {
        const context = getContext([initialStep, singleStep]);

        const throws = context.run("wrongName", async () => {
          return await Promise.resolve(true);
        });
        expect(throws).rejects.toThrow(
          new QstashWorkflowError(
            "Incompatible step name. Expected 'wrongName', got 'attemptCharge' from the request"
          )
        );
      });
      test("step type", () => {
        const context = getContext([initialStep, singleStep]);
        const throws = context.sleep("attemptCharge", 10);
        expect(throws).rejects.toThrow(
          new QstashWorkflowError(
            "Incompatible step type. Expected 'SleepFor', got 'Run' from the request"
          )
        );
      });
    });

    describe("paralel with ParallelCallState: partial", () => {
      test("step name", () => {
        const context = getContext([initialStep, parallelSteps[0]]);
        expect(context.executor.getParallelCallState(2, 1)).toBe("partial");

        const throws = Promise.all([
          context.sleep("wrongName", 10), // wrong step name
          context.sleepUntil("sleep until next day", 123_123),
        ]);
        expect(throws).rejects.toThrow(
          new QstashWorkflowError(
            "Incompatible step name. Expected 'wrongName', got 'sleep for some time' from the request"
          )
        );
      });
      test("step type", () => {
        const context = getContext([initialStep, parallelSteps[0]]);
        expect(context.executor.getParallelCallState(2, 1)).toBe("partial");

        const throws = Promise.all([
          context.sleepUntil("sleep for some time", 10), // wrong step type
          context.sleepUntil("sleep until next day", 123_123),
        ]);
        expect(throws).rejects.toThrow(
          new QstashWorkflowError(
            "Incompatible step type. Expected 'SleepUntil', got 'SleepFor' from the request"
          )
        );
      });
    });

    describe("shouldn't throw incompatibility error when paralel with ParallelCallState: discard", () => {
      test("step name", () => {
        const context = getContext([initialStep, ...parallelSteps.slice(0, 3)]);
        expect(context.executor.getParallelCallState(2, 1)).toBe("discard");

        const throws = Promise.all([
          context.sleep("wrongName", 10), // wrong step name
          context.sleepUntil("sleep until next day", 123_123),
        ]);
        expect(throws).rejects.toThrowError(QstashWorkflowAbort);
      });
      test("step type", () => {
        const context = getContext([initialStep, ...parallelSteps.slice(0, 3)]);
        expect(context.executor.getParallelCallState(2, 1)).toBe("discard");

        const throws = Promise.all([
          context.sleepUntil("sleep for some time", 10), // wrong step type
          context.sleepUntil("sleep until next day", 123_123),
        ]);
        expect(throws).rejects.toThrowError(QstashWorkflowAbort);
      });
    });

    describe("paralel with ParallelCallState: last", () => {
      test("step name", () => {
        const context = getContext([initialStep, ...parallelSteps]);
        expect(context.executor.getParallelCallState(2, 1)).toBe("last");

        const throws = Promise.all([
          context.sleep("wrongName", 10), // wrong step name
          context.sleepUntil("sleep until next day", 123_123),
        ]);
        expect(throws).rejects.toThrowError(
          new QstashWorkflowError(
            "Incompatible steps detected in parallel execution: Incompatible step name. Expected 'wrongName', got 'sleep for some time' from the request\n" +
              '  > Step Names from the request: ["sleep for some time","sleep until next day"]\n' +
              '    Step Types from the request: ["SleepFor","SleepUntil"]\n' +
              '  > Step Names expected: ["wrongName","sleep until next day"]\n' +
              '    Step Types expected: ["SleepFor","SleepUntil"]'
          )
        );
      });
      test("step type", () => {
        const context = getContext([initialStep, ...parallelSteps]);
        expect(context.executor.getParallelCallState(2, 1)).toBe("last");

        const throws = Promise.all([
          context.sleepUntil("sleep for some time", 10), // wrong step type
          context.sleepUntil("sleep until next day", 123_123),
        ]);
        expect(throws).rejects.toThrowError(
          new QstashWorkflowError(
            "Incompatible steps detected in parallel execution: Incompatible step type. Expected 'SleepUntil', got 'SleepFor' from the request\n" +
              '  > Step Names from the request: ["sleep for some time","sleep until next day"]\n' +
              '    Step Types from the request: ["SleepFor","SleepUntil"]\n' +
              '  > Step Names expected: ["sleep for some time","sleep until next day"]\n' +
              '    Step Types expected: ["SleepUntil","SleepUntil"]'
          )
        );
      });
    });
  });
});
