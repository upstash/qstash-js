import type { Err, Ok } from "neverthrow";
import { err, ok } from "neverthrow";
import type { RouteFunction, WorkflowClient } from "./types";
import { type AsyncStepFunction, type Step } from "./types";
import { AutoExecutor } from "./auto-executor";
import type { BaseLazyStep } from "./steps";
import { LazyCallStep, LazyFunctionStep, LazySleepStep, LazySleepUntilStep } from "./steps";
import type { HTTPMethods } from "../types";
import type { WorkflowLogger } from "./logger";
import { QStashWorkflowAbort } from "../error";
import { Client } from "../client";

export class WorkflowContext<TInitialPayload = unknown> {
  protected readonly executor: AutoExecutor;
  protected readonly steps: Step[];

  /**
   * QStash client of the workflow
   *
   * Can be overwritten by passing `qstashClient` parameter in `serve`:
   *
   * ```ts
   * import { Client } from "@upstash/qstash"
   *
   * export const POST = serve(
   *   async (context) => {
   *     ...
   *   },
   *   {
   *     qstashClient: new Client({...})
   *   }
   * )
   * ```
   */
  public readonly qstashClient: WorkflowClient;
  /**
   * Run id of the workflow
   */
  public readonly workflowRunId: string;
  /**
   * URL of the workflow
   *
   * Can be overwritten by passing a `url` parameter in `serve`:
   *
   * ```ts
   * export const POST = serve(
   *   async (context) => {
   *     ...
   *   },
   *   {
   *     url: "new-url-value"
   *   }
   * )
   * ```
   */
  public readonly url: string;
  /**
   * URL to call in case of workflow failure with QStash failure callback
   *
   * https://upstash.com/docs/qstash/features/callbacks#what-is-a-failure-callback
   *
   * Can be overwritten by passing a `failureUrl` parameter in `serve`:
   *
   * ```ts
   * export const POST = serve(
   *   async (context) => {
   *     ...
   *   },
   *   {
   *     failureUrl: "new-url-value"
   *   }
   * )
   * ```
   */
  public readonly failureUrl?: string;
  /**
   * Payload of the request which started the workflow.
   *
   * To specify its type, you can define `serve` as follows:
   *
   * ```ts
   * // set requestPayload type to MyPayload:
   * export const POST = serve<MyPayload>(
   *   async (context) => {
   *     ...
   *   }
   * )
   * ```
   *
   * By default, `serve` tries to apply `JSON.parse` to the request payload.
   * If your payload is encoded in a format other than JSON, you can utilize
   * the `initialPayloadParser` parameter:
   *
   * ```ts
   * export const POST = serve<MyPayload>(
   *   async (context) => {
   *     ...
   *   },
   *   {
   *     initialPayloadParser: (initialPayload) => {return doSomething(initialPayload)}
   *   }
   * )
   * ```
   */
  public readonly requestPayload: TInitialPayload;
  /**
   * headers of the initial request
   */
  public readonly headers: Headers;
  /**
   * initial payload as a raw string
   */
  public readonly rawInitialPayload: string;
  /**
   * Map of environment variables and their values.
   *
   * Can be set using the `env` option of serve:
   *
   * ```ts
   * export const POST = serve<MyPayload>(
   *   async (context) => {
   *     const key = context.env["API_KEY"];
   *   },
   *   {
   *     env: {
   *       "API_KEY": "*****";
   *     }
   *   }
   * )
   * ```
   *
   * Default value is set to `process.env`.
   */
  public readonly env;

  constructor({
    qstashClient,
    workflowRunId,
    headers,
    steps,
    url,
    failureUrl,
    debug,
    initialPayload,
    rawInitialPayload,
    env,
  }: {
    qstashClient: WorkflowClient;
    workflowRunId: string;
    headers: Headers;
    steps: Step[];
    url: string;
    failureUrl?: string;
    debug?: WorkflowLogger;
    initialPayload: TInitialPayload;
    rawInitialPayload?: string; // optional for tests
    env?: Record<string, string | undefined>;
  }) {
    this.qstashClient = qstashClient;
    this.workflowRunId = workflowRunId;
    this.steps = steps;
    this.url = url;
    this.failureUrl = failureUrl;
    this.headers = headers;
    this.requestPayload = initialPayload;
    this.rawInitialPayload = rawInitialPayload ?? JSON.stringify(this.requestPayload);
    this.env = env;

    this.executor = new AutoExecutor(this, this.steps, debug);
  }

  /**
   * Executes a workflow step
   *
   * ```typescript
   * const result = await context.run("step 1", async () => {
   *   return await Promise.resolve("result")
   * })
   * ```
   *
   * Can also be called in parallel and the steps will be executed
   * simulatenously:
   *
   * ```typescript
   * const [result1, result2] = await Promise.all([
   *   context.run("step 1", async () => {
   *     return await Promise.resolve("result1")
   *   })
   *   context.run("step 2", async () => {
   *     return await Promise.resolve("result2")
   *   })
   * ])
   * ```
   *
   * @param stepName name of the step
   * @param stepFunction step function to be executed
   * @returns result of the step function
   */
  public async run<TResult>(
    stepName: string,
    stepFunction: AsyncStepFunction<TResult>
  ): Promise<TResult> {
    const wrappedStepFunction = async () => this.executor.wrapStep(stepName, stepFunction);
    return this.addStep<TResult>(new LazyFunctionStep(stepName, wrappedStepFunction));
  }

  /**
   * Stops the execution for the duration provided.
   *
   * @param stepName
   * @param duration sleep duration in seconds
   * @returns undefined
   */
  public async sleep(stepName: string, duration: number): Promise<void> {
    await this.addStep(new LazySleepStep(stepName, duration));
  }

  /**
   * Stops the execution until the date time provided.
   *
   * @param stepName
   * @param datetime time to sleep until. Can be provided as a number (in unix seconds),
   *   as a Date object or a string (passed to `new Date(datetimeString)`)
   * @returns undefined
   */
  public async sleepUntil(stepName: string, datetime: Date | string | number): Promise<void> {
    let time: number;
    if (typeof datetime === "number") {
      time = datetime;
    } else {
      datetime = typeof datetime === "string" ? new Date(datetime) : datetime;
      // get unix seconds
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      time = Math.round(datetime.getTime() / 1000);
    }
    await this.addStep(new LazySleepUntilStep(stepName, time));
  }

  /**
   * Makes a third party call through QStash in order to make a
   * network call without consuming any runtime.
   *
   * ```ts
   * const postResult = await context.call<string>(
   *   "post call step",
   *   `https://www.some-endpoint.com/api`,
   *   "POST",
   *   "my-payload"
   * );
   * ```
   *
   * @param stepName
   * @param url url to call
   * @param method call method
   * @param body call body
   * @param headers call headers
   * @returns call result
   */
  public async call<TResult = unknown, TBody = unknown>(
    stepName: string,
    url: string,
    method: HTTPMethods,
    body?: TBody,
    headers?: Record<string, string>
  ) {
    return await this.addStep(
      new LazyCallStep<TResult>(stepName, url, method, body, headers ?? {})
    );
  }

  /**
   * Adds steps to the executor. Needed so that it can be overwritten in
   * DisabledWorkflowContext.
   */
  protected async addStep<TResult = unknown>(step: BaseLazyStep<TResult>) {
    return await this.executor.addStep(step);
  }
}

/**
 * Workflow context which throws QStashWorkflowAbort before running the steps.
 *
 * Used for making a dry run before running any steps to check authentication.
 *
 * Consider an endpoint like this:
 * ```ts
 * export const POST = serve({
 *   routeFunction: context => {
 *     if (context.headers.get("authentication") !== "Bearer secretPassword") {
 *       console.error("Authentication failed.");
 *       return;
 *     }
 *
 *     // ...
 *   }
 * })
 * ```
 *
 * the serve method will first call the routeFunction with an DisabledWorkflowContext.
 * Here is the action we take in different cases
 * - "step-found": we will run the workflow related sections of `serve`.
 * - "run-ended": simply return success and end the workflow
 * - error: returns 500.
 */
export class DisabledWorkflowContext<
  TInitialPayload = unknown,
> extends WorkflowContext<TInitialPayload> {
  private static readonly disabledMessage = "disabled-qstash-worklfow-run";

  /**
   * overwrite the WorkflowContext.addStep method to always raise QStashWorkflowAbort
   * error in order to stop the execution whenever we encounter a step.
   *
   * @param _step
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async addStep<TResult = unknown>(_step: BaseLazyStep<TResult>): Promise<TResult> {
    throw new QStashWorkflowAbort(DisabledWorkflowContext.disabledMessage);
  }

  /**
   * copies the passed context to create a DisabledWorkflowContext. Then, runs the
   * route function with the new context.
   *
   * - returns "run-ended" if there are no steps found or
   *      if the auth failed and user called `return`
   * - returns "step-found" if DisabledWorkflowContext.addStep is called.
   * - if there is another error, returns the error.
   *
   * @param routeFunction
   */
  public static async tryAuthentication<TInitialPayload = unknown>(
    routeFunction: RouteFunction<TInitialPayload>,
    context: WorkflowContext<TInitialPayload>
  ): Promise<Ok<"step-found" | "run-ended", never> | Err<never, Error>> {
    const disabledContext = new DisabledWorkflowContext({
      qstashClient: new Client({ baseUrl: "disabled-client", token: "disabled-client" }),
      workflowRunId: context.workflowRunId,
      headers: context.headers,
      steps: [],
      url: context.url,
      failureUrl: context.failureUrl,
      initialPayload: context.requestPayload,
      rawInitialPayload: context.rawInitialPayload,
    });

    try {
      await routeFunction(disabledContext);
    } catch (error) {
      if (error instanceof QStashWorkflowAbort && error.stepName === this.disabledMessage) {
        return ok("step-found");
      }
      return err(error as Error);
    }

    return ok("run-ended");
  }
}
