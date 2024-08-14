import type { Err, Ok } from "neverthrow";
import { err, ok } from "neverthrow";
import type { RouteFunction } from "./types";
import { type AsyncStepFunction, type Step } from "./types";
import { Client } from "../client";
import { AutoExecutor } from "./auto-executor";
import type { BaseLazyStep } from "./steps";
import { LazyCallStep, LazyFunctionStep, LazySleepStep, LazySleepUntilStep } from "./steps";
import type { HTTPMethods } from "../types";
import type { WorkflowLogger } from "./logger";
import { QstashWorkflowAbort } from "../error";

export class WorkflowContext<TInitialPayload = unknown> {
  protected readonly executor: AutoExecutor;
  protected readonly steps: Step[];

  public readonly client: Client;
  public readonly workflowRunId: string;
  public readonly url: string;
  public readonly failureUrl: string | false;
  public readonly requestPayload: TInitialPayload;
  public readonly headers: Headers;
  public readonly rawInitialPayload: string;

  constructor({
    client,
    workflowRunId,
    headers,
    steps,
    url,
    failureUrl = false,
    debug,
    initialPayload,
    rawInitialPayload,
  }: {
    client: Client;
    workflowRunId: string;
    headers: Headers;
    steps: Step[];
    url: string;
    failureUrl?: string | false;
    debug?: WorkflowLogger;
    initialPayload: TInitialPayload;
    rawInitialPayload?: string; // optional for tests
  }) {
    this.client = client;
    this.workflowRunId = workflowRunId;
    this.steps = steps;
    this.url = url;
    this.failureUrl = failureUrl;
    this.headers = headers;
    this.requestPayload = initialPayload;
    this.rawInitialPayload = rawInitialPayload ?? JSON.stringify(this.requestPayload);

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
   * @returns
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
   * @returns
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
 * Workflow context which throws QstashWorkflowAbort before running the steps.
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
   * overwrite the WorkflowContext.addStep method to always raise QstashWorkflowAbort
   * error in order to stop the execution whenever we encounter a step.
   *
   * @param _step
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async addStep<TResult = unknown>(_step: BaseLazyStep<TResult>): Promise<TResult> {
    throw new QstashWorkflowAbort(DisabledWorkflowContext.disabledMessage);
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
      client: new Client({ baseUrl: "disabled-client", token: "disabled-client" }),
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
      if (error instanceof QstashWorkflowAbort && error.stepName === this.disabledMessage) {
        return ok("step-found");
      }
      return err(error as Error);
    }

    return ok("run-ended");
  }
}
