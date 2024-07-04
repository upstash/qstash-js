/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { afterEach, describe, expect, test } from "bun:test";
import type { PublishRequest, PublishResponse } from "../client";
import { Client } from "../client";
import type { AsyncStepFunction, Step } from "./types";
import { QstashWorkflowAbort } from "../error";
import { WorkflowContext } from "./context";

export class SpyWorkflowContext<
  TInitialRequest = unknown,
> extends WorkflowContext<TInitialRequest> {
  public declare client;
  public declare url;
  public declare workflowId;
  public declare steps;
  public declare executor;

  static async createContext<TInitialRequest>(request: Request, client: Client) {
    const workflow = WorkflowContext.createContext<TInitialRequest>(request, client) as unknown as {
      workflowContext: SpyWorkflowContext<TInitialRequest>;
      isFirstInvocation: boolean;
    };
    return await Promise.resolve(workflow);
  }
}

/**
 * Client mocking the publishJSON method by disabling sending requests
 * to qstash but saving the requests in an array instead. The array will
 * be checked in the tests
 */
class SpyClient extends Client {
  public publishedJSON: PublishRequest<unknown>[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await
  public async publishJSON<
    TBody = unknown,
    TRequest extends PublishRequest<TBody> = PublishRequest<TBody>,
  >(request: TRequest): Promise<PublishResponse<TRequest>> {
    this.publishedJSON.push(request);
    return {
      url: request.url,
      messageId: "id",
    } as PublishResponse<TRequest>;
  }
}

/**
 * Helper method to verify that steps run/don't run or return the expected
 * result
 *
 * @param client spy client used in the workflow
 * @param workflow spy workflow
 * @param step step to run
 * @param shouldRun whether the step should run
 * @param shouldReturn what the step should return if it runs
 * @param shouldPublish JSON to be published in the step if it runs
 */
const expectStep = async <TResult>(
  client: SpyClient,
  workflow: SpyWorkflowContext,
  step: AsyncStepFunction<TResult>,
  stepName: string,
  shouldRun: boolean,
  shouldReturn: TResult,
  shouldPublish: PublishRequest[]
): Promise<TResult> => {
  const stepCountBefore = workflow.executor.stepCount;

  let abortError;
  let result;
  try {
    // if the result exists in the steps, it's simply returned
    result = (await workflow.run(stepName, step)) as TResult;
  } catch (error) {
    // if the step is executed, QstashWorkflowAbort is thrown
    if (error instanceof QstashWorkflowAbort) {
      result = error.stepInfo?.out as TResult;
      abortError = error;
    } else {
      throw error;
    }
  }

  const stepCountAfter = workflow.executor.stepCount;

  expect(stepCountAfter).toBe(stepCountBefore + 1);

  if (shouldRun) {
    expect(client.publishedJSON.length > 0).toBeTrue();

    expect(result).toEqual(shouldReturn);
    expect(client.publishedJSON).toEqual(shouldPublish);
    client.publishedJSON = [];
  } else {
    expect(client.publishedJSON).toBeEmpty();
  }

  if (abortError) {
    // re-raise the abort error so that execution stops
    throw abortError;
  } else {
    // return the result if it exists
    return result;
  }
};

const expectParallel = (
  client: SpyClient,
  result: unknown,
  shouldReturn: unknown,
  shouldPublish: PublishRequest[]
) => {
  expect(result).toEqual(shouldReturn);
  expect(client.publishedJSON).toEqual(shouldPublish);
  client.publishedJSON = [];
};

/**
 * Given a client, list of steps, list of return values and list of publish
 * values; tests an endpoint
 *
 * It will start with a request whose body is provided by the user. It will
 * continue by adding each step one by one and checking the expected values
 *
 * @param client
 * @param steps
 * @param returnValues
 * @param publishValues values published at each step
 */
const runRoute = async ({
  initialBody,
  workflowRoute,
  steps,
}: {
  initialBody: unknown;
  workflowRoute: (
    request: Request,
    expectedRunningStepId: number,
    initialBody: unknown
  ) => Promise<string>;
  steps: Step[];
}) => {
  const base64encodedSteps = steps.map((step) => btoa(JSON.stringify(JSON.stringify(step))));

  // initial call with user payload
  const initialRequest = new Request("https://www.mock.url.com", {
    headers: {},
    body: JSON.stringify(initialBody),
  });

  const workflowId = await workflowRoute(initialRequest, 0, initialBody);

  for (let index = 1; index < steps.length; index += 1) {
    const stepsInRequest = base64encodedSteps.slice(0, index);
    const request = new Request("https://www.mock.url.com", {
      headers: {
        "Upstash-Workflow-InternalCall": "yes",
        "Upstash-Workflow-Id": workflowId,
      },
      body: JSON.stringify(stepsInRequest),
    });

    try {
      await workflowRoute(request, index, initialBody);
    } catch (error) {
      if (!(error instanceof QstashWorkflowAbort)) {
        throw error;
      }
    }
  }
};

/**
 * In this test, we simulate a workflow run, where an api endpoint with
 * a workflow is called consecutively from Qstash
 */
describe("Should handle workflow correctly", () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new SpyClient({ token: process.env.QSTASH_TOKEN! });

  afterEach(() => {
    client.publishedJSON = [];
  });

  test("test consecutive requests", async () => {
    const routeToTest = async (
      request: Request,
      expectedRunningStepId: number,
      initialBody: unknown
    ) => {
      const { workflowContext: workflow } = await SpyWorkflowContext.createContext(request, client);
      expect(workflow.url).toBe(request.url);
      // in the first invocation, don't test anything and return
      // `serve` method will handle the first request
      if (expectedRunningStepId === 0) {
        return workflow.workflowId;
      }

      const result1 = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve([111, workflow.steps[0].out]);
        },
        "step1",
        expectedRunningStepId === 1,
        [111, initialBody],
        [
          {
            body: '{"stepId":1,"stepName":"step1","out":[111,{"foo":"bar"}],"concurrent":1,"targetStep":0}',
            delay: undefined,
            headers: {
              "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
              "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
              "Upstash-Workflow-Id": workflow.workflowId,
            },
            method: "POST",
            notBefore: undefined,
            url: "https://www.mock.url.com/",
          },
        ]
      );

      const result2 = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve([222, result1]);
        },
        "step2",
        expectedRunningStepId === 2,
        [222, [111, initialBody]],
        [
          {
            body: '{"stepId":2,"stepName":"step2","out":[222,[111,{"foo":"bar"}]],"concurrent":1,"targetStep":0}',
            delay: undefined,
            headers: {
              "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
              "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
              "Upstash-Workflow-Id": workflow.workflowId,
            },
            method: "POST",
            notBefore: undefined,
            url: "https://www.mock.url.com/",
          },
        ]
      );

      if (expectedRunningStepId === 2) {
        expect(result2).toEqual([
          222,
          [
            111,
            {
              foo: "bar",
            },
          ],
        ]);
      } else {
        expect(result2 as unknown).toBe(undefined);
      }

      return workflow.workflowId;
    };

    const initialBody = { foo: "bar" };
    await runRoute({
      initialBody: initialBody,
      workflowRoute: routeToTest,
      steps: [
        {
          stepId: 0,
          stepName: "init",
          out: initialBody,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 1,
          stepName: "step 1",
          out: [111, initialBody],
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 2,
          stepName: "step 2",
          out: [222, [111, initialBody]],
          concurrent: 1,
          targetStep: 0,
        },
      ],
    });
  });

  test("test parallel step", async () => {
    const routeToTest = async (request: Request, expectedRunningStepId: number) => {
      const { workflowContext: workflow } = await SpyWorkflowContext.createContext(request, client);
      expect(workflow.url).toBe(request.url);
      // in the first invocation, don't test anything and return
      // `serve` method will handle the first request
      if (expectedRunningStepId === 0) {
        return workflow.workflowId;
      }

      const result1 = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve(444);
        },
        "first step",
        expectedRunningStepId === 1,
        444,
        [
          {
            body: '{"stepId":1,"stepName":"first step","out":444,"concurrent":1,"targetStep":0}',
            delay: undefined,
            headers: {
              "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
              "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
              "Upstash-Workflow-Id": workflow.workflowId,
            },
            method: "POST",
            notBefore: undefined,
            url: "https://www.mock.url.com/",
          },
        ]
      );

      let parallelResult1;
      try {
        parallelResult1 = await Promise.all([
          workflow.run("parallel step 1", async () => {
            return await Promise.resolve(555 - result1);
          }),
          workflow.run("parallel step 2", async () => {
            return await Promise.resolve(666 - result1);
          }),
        ]);
      } catch (error) {
        if (error instanceof QstashWorkflowAbort) {
          parallelResult1 = undefined;
          switch (expectedRunningStepId) {
            case 2: {
              expectParallel(client, parallelResult1, undefined, [
                {
                  body: '{"stepId":0,"stepName":"parallel step 1","concurrent":2,"targetStep":2}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
                {
                  body: '{"stepId":0,"stepName":"parallel step 2","concurrent":2,"targetStep":3}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
              ]);
              break;
            }
            case 3: {
              expectParallel(client, parallelResult1, undefined, [
                {
                  body: '{"stepId":2,"stepName":"parallel step 1","out":111,"concurrent":1,"targetStep":0}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
              ]);
              break;
            }
            case 4: {
              expectParallel(client, parallelResult1, undefined, []);
              break;
            }
            case 5: {
              expectParallel(client, parallelResult1, undefined, [
                {
                  body: '{"stepId":3,"stepName":"parallel step 2","out":222,"concurrent":1,"targetStep":0}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
              ]);
              break;
            }
          }
        }
        throw error;
      }
      expectParallel(client, parallelResult1, [111, 222], []);

      let parallelResult2: unknown;
      try {
        parallelResult2 = await Promise.all([
          workflow.run("parallel step 1", async () => {
            return await Promise.resolve(parallelResult1[0] * 2);
          }),
          workflow.run("parallel step 2", async () => {
            return await Promise.resolve(parallelResult1[1] * 2);
          }),
        ]);
      } catch (error) {
        if (error instanceof QstashWorkflowAbort) {
          parallelResult2 = undefined;
          switch (expectedRunningStepId) {
            case 6: {
              expectParallel(client, parallelResult2, undefined, [
                {
                  body: '{"stepId":0,"stepName":"parallel step 1","concurrent":2,"targetStep":4}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
                {
                  body: '{"stepId":0,"stepName":"parallel step 2","concurrent":2,"targetStep":5}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
              ]);
              break;
            }
            case 7: {
              expectParallel(client, parallelResult2, undefined, [
                {
                  body: '{"stepId":4,"stepName":"parallel step 1","out":222,"concurrent":1,"targetStep":0}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
              ]);
              break;
            }
            case 8: {
              expectParallel(client, parallelResult2, undefined, [
                {
                  body: '{"stepId":5,"stepName":"parallel step 2","out":444,"concurrent":1,"targetStep":0}',
                  delay: undefined,
                  headers: {
                    "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                    "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                    "Upstash-Workflow-Id": workflow.workflowId,
                  },
                  method: "POST",
                  notBefore: undefined,
                  url: "https://www.mock.url.com/",
                },
              ]);
              break;
            }
          }
        }
        throw error;
      }

      expectParallel(client, parallelResult2, [222, 444], []);

      const resultLast = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve([parallelResult1, parallelResult2]);
        },
        "stepLast",
        expectedRunningStepId === 10,
        [
          [111, 222],
          [222, 444],
        ],
        [
          {
            body: '{"stepId":6,"stepName":"stepLast","out":[[111,222],[222,444]],"concurrent":1,"targetStep":0}',
            delay: undefined,
            headers: {
              "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
              "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
              "Upstash-Workflow-Id": workflow.workflowId,
            },
            method: "POST",
            notBefore: undefined,
            url: "https://www.mock.url.com/",
          },
        ]
      );

      if (expectedRunningStepId === 10) {
        expect(resultLast).toEqual([
          [111, 222],
          [222, 444],
        ]);
      } else {
        expect(resultLast as unknown).toBe(undefined);
      }
      return workflow.workflowId;
    };

    await runRoute({
      initialBody: { foo: "baz" },
      workflowRoute: routeToTest,
      steps: [
        {
          stepId: 0,
          stepName: "init",
          out: { foo: "baz" },
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 1,
          stepName: "mock",
          out: 444,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 0,
          stepName: "mock",
          concurrent: 2,
          targetStep: 2,
        },
        {
          stepId: 2,
          stepName: "mock",
          out: 111,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 0,
          stepName: "mock",
          concurrent: 2,
          targetStep: 3,
        },
        {
          stepId: 3,
          stepName: "mock",
          out: 222,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 0,
          stepName: "mock",
          concurrent: 2,
          targetStep: 4,
        },
        {
          stepId: 0,
          stepName: "mock",
          concurrent: 2,
          targetStep: 5,
        },
        {
          stepId: 4,
          stepName: "mock",
          concurrent: 1,
          out: 222,
          targetStep: 0,
        },
        {
          stepId: 5,
          stepName: "mock",
          concurrent: 1,
          out: 444,
          targetStep: 0,
        },
        {
          stepId: 2,
          stepName: "mock",
          out: [
            [111, 222],
            [222, 444],
          ],
          concurrent: 1,
          targetStep: 0,
        },
      ],
    });
  });

  test("test for loop", async () => {
    const routeToTest = async (request: Request, expectedRunningStepId: number) => {
      const { workflowContext: workflow } = await SpyWorkflowContext.createContext(request, client);
      expect(workflow.url).toBe(request.url);
      // in the first invocation, don't test anything and return
      // `serve` method will handle the first request
      if (expectedRunningStepId === 0) {
        return workflow.workflowId;
      }

      let accumulator = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve(
            (workflow.steps[0].out as { initialValue: number }).initialValue
          );
        },
        "stepFirst",
        expectedRunningStepId === 1,
        10,
        [
          {
            body: '{"stepId":1,"stepName":"stepFirst","out":10,"concurrent":1,"targetStep":0}',
            delay: undefined,
            headers: {
              "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
              "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
              "Upstash-Workflow-Id": workflow.workflowId,
            },
            method: "POST",
            notBefore: undefined,
            url: "https://www.mock.url.com/",
          },
        ]
      );

      const results = [10, 20, 60];
      for (let index = 0; index < 3; index++) {
        accumulator = await expectStep<number>(
          client,
          workflow,
          async () => {
            return await Promise.resolve(accumulator + accumulator * index);
          },
          `step ${index}`,
          expectedRunningStepId === 2 + index,
          results[index],
          [
            {
              body: `{"stepId":${2 + index},"stepName":"step ${index}","out":${results[index]},"concurrent":1,"targetStep":0}`,
              delay: undefined,
              headers: {
                "Upstash-Forward-Upstash-Workflow-Id": workflow.workflowId,
                "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
                "Upstash-Workflow-Id": workflow.workflowId,
              },
              method: "POST",
              notBefore: undefined,
              url: "https://www.mock.url.com/",
            },
          ]
        );
      }

      if (expectedRunningStepId === 4) {
        expect(accumulator).toEqual(60);
      } else {
        expect(accumulator as unknown).toBe(undefined);
      }

      return workflow.workflowId;
    };

    await runRoute({
      initialBody: { initialValue: 10 },
      workflowRoute: routeToTest,
      steps: [
        {
          stepId: 0,
          stepName: "init",
          out: { initialValue: 10 },
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepName: "mock",
          stepId: 1,
          out: 10,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepName: "mock",
          stepId: 2,
          out: 10,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepName: "mock",
          stepId: 3,
          out: 20,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 4,
          stepName: "mock",
          out: 60,
          concurrent: 1,
          targetStep: 0,
        },
      ],
    });
  });
});
