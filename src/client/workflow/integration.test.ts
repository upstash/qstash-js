/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { afterEach, describe, expect, test } from "bun:test";
import type { PublishRequest, PublishResponse } from "../client";
import { Client } from "../client";
import { SpyWorkflow } from "./workflow.test";
import type { AsyncStepFunction, Step } from "./types";

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
  workflow: SpyWorkflow,
  step: AsyncStepFunction<TResult>,
  shouldRun: boolean,
  shouldReturn: TResult,
  shouldPublish: PublishRequest[]
): Promise<TResult> => {
  const skipBefore = workflow.skip;
  const stepCountBefore = workflow.stepCount;

  const result = (await workflow.run("step", step)) as TResult;

  const skipAfter = workflow.skip;
  const stepCountAfter = workflow.stepCount;

  expect(stepCountAfter).toBe(stepCountBefore + 1);

  if (shouldRun) {
    expect(skipBefore).toBeFalse();
    expect(skipAfter).toBeTrue();
    expect(client.publishedJSON.length > 0).toBeTrue();

    expect(result).toEqual(shouldReturn);
    expect(client.publishedJSON).toEqual(shouldPublish);
    client.publishedJSON = [];
  } else {
    expect(skipBefore === skipAfter).toBeTrue();
    expect(client.publishedJSON).toBeEmpty();
  }

  return result;
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

const initialCheck = (client: SpyClient, workflowId: string, initialBody: unknown) => {
  // no steps were run, so client.publishedJSON field was never flushed
  // the initial submission should be in it
  expect(client.publishedJSON.length).toBe(1);
  expect(client.publishedJSON).toEqual([
    {
      headers: {
        "Upstash-Forward-Upstash-Workflow-InternalCall": "yes",
        "Upstash-Forward-Upstash-Workflow-Id": workflowId,
        "Upstash-Workflow-Id": workflowId,
      },
      method: "POST",
      body: `{"stepId":0,"out":${JSON.stringify(initialBody)},"concurrent":1,"targetStep":0}`,
      url: "https://www.mock.url.com/",
      notBefore: undefined,
      delay: undefined,
    },
  ]);
  // clear the list
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

    await workflowRoute(request, index, initialBody);
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

  test("test initial request", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const routeToTest = async (
      request: Request,
      expectedRunningStepId: number,
      initialBody: unknown
    ) => {
      const workflow = await SpyWorkflow.createWorkflow(request, client);
      expect(workflow.url).toBe(request.url);
      if (expectedRunningStepId === 0) {
        initialCheck(client, workflow.workflowId, initialBody);
      }

      return workflow.workflowId;
    };

    await runRoute({
      initialBody: { foo: "baz" },
      workflowRoute: routeToTest,
      steps: [],
    });
  });

  test("test consecutive requests", async () => {
    const routeToTest = async (
      request: Request,
      expectedRunningStepId: number,
      initialBody: unknown
    ) => {
      const workflow = await SpyWorkflow.createWorkflow(request, client);
      expect(workflow.url).toBe(request.url);
      if (expectedRunningStepId === 0) {
        initialCheck(client, workflow.workflowId, initialBody);
      }

      const result1 = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve([111, workflow.requestPayload]);
        },
        expectedRunningStepId === 1,
        [111, workflow.requestPayload],
        [
          {
            body: '{"stepId":1,"out":[111,{"foo":"bar"}],"concurrent":1,"targetStep":0}',
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
        expectedRunningStepId === 2,
        [222, [111, workflow.requestPayload]],
        [
          {
            body: '{"stepId":2,"out":[222,[111,{"foo":"bar"}]],"concurrent":1,"targetStep":0}',
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
          out: initialBody,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 1,
          out: [111, initialBody],
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 2,
          out: [222, [111, initialBody]],
          concurrent: 1,
          targetStep: 0,
        },
      ],
    });
  });

  test("test parallel step", async () => {
    const routeToTest = async (
      request: Request,
      expectedRunningStepId: number,
      initialBody: unknown
    ) => {
      const workflow = await SpyWorkflow.createWorkflow(request, client);
      expect(workflow.url).toBe(request.url);
      if (expectedRunningStepId === 0) {
        initialCheck(client, workflow.workflowId, initialBody);
      }

      const result1 = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve(444);
        },
        expectedRunningStepId === 1,
        444,
        [
          {
            body: '{"stepId":1,"out":444,"concurrent":1,"targetStep":0}',
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

      const parallelResult1 = await Promise.all([
        workflow.run("parallel step 1", async () => {
          return await Promise.resolve(555 - result1);
        }),
        workflow.run("parallel step 2", async () => {
          return await Promise.resolve(666 - result1);
        }),
      ]);

      switch (expectedRunningStepId) {
        case 2: {
          expectParallel(
            client,
            parallelResult1,
            [],
            [
              {
                body: '{"stepId":0,"concurrent":2,"targetStep":2}',
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
                body: '{"stepId":0,"concurrent":2,"targetStep":3}',
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
          break;
        }
        case 3: {
          expectParallel(
            client,
            parallelResult1,
            [],
            [
              {
                body: '{"stepId":2,"out":111,"concurrent":1,"targetStep":0}',
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
          break;
        }
        case 4: {
          expectParallel(client, parallelResult1, [], []);
          break;
        }
        case 5: {
          expectParallel(
            client,
            parallelResult1,
            [],
            [
              {
                body: '{"stepId":3,"out":222,"concurrent":1,"targetStep":0}',
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
          break;
        }
        default: {
          if (expectedRunningStepId < 2) {
            expectParallel(client, parallelResult1, [], []);
          } else {
            expectParallel(client, parallelResult1, [111, 222], []);
          }
        }
      }

      const parallelResult2 = await Promise.all([
        workflow.run("parallel step 1", async () => {
          return await Promise.resolve(parallelResult1[0] * 2);
        }),
        workflow.run("parallel step 2", async () => {
          return await Promise.resolve(parallelResult1[1] * 2);
        }),
      ]);

      switch (expectedRunningStepId) {
        case 6: {
          expectParallel(
            client,
            parallelResult2,
            [],
            [
              {
                body: '{"stepId":0,"concurrent":2,"targetStep":4}',
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
                body: '{"stepId":0,"concurrent":2,"targetStep":5}',
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
          break;
        }
        case 7: {
          expectParallel(
            client,
            parallelResult2,
            [],
            [
              {
                body: '{"stepId":4,"out":222,"concurrent":1,"targetStep":0}',
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
          break;
        }
        case 8: {
          expectParallel(
            client,
            parallelResult2,
            [],
            [
              {
                body: '{"stepId":5,"out":444,"concurrent":1,"targetStep":0}',
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
          break;
        }
        case 9: {
          expectParallel(client, parallelResult2, [], []);
          break;
        }
        default: {
          if (expectedRunningStepId < 6) {
            expectParallel(client, parallelResult2, [], []);
          } else {
            expectParallel(client, parallelResult2, [222, 444], []);
          }
        }
      }

      const resultLast = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve([parallelResult1, parallelResult2]);
        },
        expectedRunningStepId === 10,
        [
          [111, 222],
          [222, 444],
        ],
        [
          {
            body: '{"stepId":6,"out":[[111,222],[222,444]],"concurrent":1,"targetStep":0}',
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
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 1,
          out: 444,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 0,
          concurrent: 2,
          targetStep: 2,
        },
        {
          stepId: 2,
          out: 111,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 0,
          concurrent: 2,
          targetStep: 3,
        },
        {
          stepId: 3,
          out: 222,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 0,
          concurrent: 2,
          targetStep: 4,
        },
        {
          stepId: 0,
          concurrent: 2,
          targetStep: 5,
        },
        {
          stepId: 4,
          concurrent: 1,
          out: 222,
          targetStep: 0,
        },
        {
          stepId: 5,
          concurrent: 1,
          out: 444,
          targetStep: 0,
        },
        {
          stepId: 2,
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

  test.only("test for loop", async () => {
    const routeToTest = async (
      request: Request,
      expectedRunningStepId: number,
      initialBody: unknown
    ) => {
      const workflow = await SpyWorkflow.createWorkflow<{ initialValue: number }>(request, client);
      expect(workflow.url).toBe(request.url);
      if (expectedRunningStepId === 0) {
        initialCheck(client, workflow.workflowId, initialBody);
      }

      let accumulator = await expectStep(
        client,
        workflow,
        async () => {
          return await Promise.resolve(workflow.requestPayload.initialValue);
        },
        expectedRunningStepId === 1,
        10,
        [
          {
            body: '{"stepId":1,"out":10,"concurrent":1,"targetStep":0}',
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
          expectedRunningStepId === 2 + index,
          results[index],
          [
            {
              body: `{"stepId":${2 + index},"out":${results[index]},"concurrent":1,"targetStep":0}`,
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
          out: { initialValue: 10 },
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 1,
          out: 10,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 2,
          out: 10,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 3,
          out: 20,
          concurrent: 1,
          targetStep: 0,
        },
        {
          stepId: 4,
          out: 60,
          concurrent: 1,
          targetStep: 0,
        },
      ],
    });
  });
});
