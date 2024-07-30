import { type AsyncStepFunction, type Step } from "./types";
import type { Client } from "../client";
import { AutoExecutor } from "./auto-executor";
import { LazyCallStep, LazyFunctionStep, LazySleepStep, LazySleepUntilStep } from "./steps";
import type { HTTPMethods } from "../types";
import type { WorkflowLogger } from "./logger";

export class WorkflowContext<TInitialPayload = unknown> {
  protected readonly executor: AutoExecutor;

  public readonly client: Client;
  public readonly workflowId: string;
  public readonly steps: Step[];
  public readonly nonPlanStepCount: number;
  public readonly url: string;
  public readonly requestPayload: TInitialPayload;
  public readonly headers: Headers;

  constructor({
    client,
    workflowId,
    initialPayload,
    headers,
    steps,
    url,
    debug,
  }: {
    client: Client;
    workflowId: string;
    initialPayload: TInitialPayload;
    headers: Headers;
    steps: Step[];
    url: string;
    debug?: WorkflowLogger;
  }) {
    this.client = client;
    this.workflowId = workflowId;
    this.steps = steps;
    this.url = url;
    this.requestPayload = initialPayload;
    this.headers = headers;
    this.nonPlanStepCount = this.steps.filter((step) => !step.targetStep).length;

    this.executor = new AutoExecutor(this, debug);
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
    return this.executor.addStep<TResult>(new LazyFunctionStep(stepName, stepFunction));
  }

  /**
   * Stops the execution for the duration provided.
   *
   * @param stepName
   * @param duration sleep duration in seconds
   * @returns
   */
  public async sleep(stepName: string, duration: number): Promise<void> {
    await this.executor.addStep(new LazySleepStep(stepName, duration));
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
    await this.executor.addStep(new LazySleepUntilStep(stepName, time));
  }

  public async call<TResult = unknown, TBody = unknown>(
    stepName: string,
    url: string,
    method: HTTPMethods,
    body?: TBody,
    headers?: Record<string, string>
  ) {
    return await this.executor.addStep(
      new LazyCallStep<TResult>(stepName, url, method, body, headers ?? {})
    );
  }
}
