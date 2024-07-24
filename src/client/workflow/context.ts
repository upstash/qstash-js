import { type AsyncStepFunction, type Step } from "./types";
import {
  DEFAULT_CONTENT_TYPE,
  WORKFLOW_ID_HEADER,
  WORKFLOW_INIT_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";
import type { Client } from "../client";
import { AutoExecutor } from "./auto-executor";
import { LazyCallStep, LazyFunctionStep, LazySleepStep, LazySleepUntilStep } from "./steps";
import type { HTTPMethods } from "../types";

export class WorkflowContext<TInitialPayload = unknown> {
  protected readonly executor: AutoExecutor;
  public readonly client: Client;
  public readonly workflowId: string;
  public readonly steps: Step[];
  public readonly nonPlanStepCount: number;
  public readonly url: string;
  public readonly requestPayload: TInitialPayload;

  constructor({
    client,
    workflowId,
    initialPayload,
    steps,
    url,
  }: {
    client: Client;
    workflowId: string;
    initialPayload: TInitialPayload;
    steps: Step[];
    url: string;
  }) {
    this.client = client;
    this.workflowId = workflowId;
    this.steps = steps;
    this.url = url;
    this.requestPayload = initialPayload;
    this.nonPlanStepCount = this.steps.filter((step) => !step.targetStep).length;

    this.executor = new AutoExecutor(this);
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

  /**
   * Gets headers for calling QStash
   *
   * @param initHeaderValue Whether the invocation should create a new workflow
   * @returns
   */
  public getHeaders(initHeaderValue: "true" | "false", step?: Step, contentType?: string) {
    let baseHeaders: Record<string, string> = {
      [WORKFLOW_INIT_HEADER]: initHeaderValue,
      [WORKFLOW_ID_HEADER]: this.workflowId,
      [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
    };

    if (step?.callHeaders && step.callMethod) {
      const forwardedHeaders = Object.fromEntries(
        Object.entries(step.callHeaders).map(([header, value]) => [
          `Upstash-Forward-${header}`,
          value,
        ])
      );
      baseHeaders = {
        ...baseHeaders,
        "Upstash-Callback": this.url,
        "Upstash-Callback-Workflow-Id": this.workflowId,
        "Upstash-Callback-Workflow-CallType": "fromCallback",
        "Upstash-Callback-Workflow-Init": "false",

        "Upstash-Callback-Forward-Upstash-Workflow-Callback": "true",
        "Upstash-Callback-Forward-Upstash-Workflow-StepId": step.stepId.toString(),
        "Upstash-Callback-Forward-Upstash-Workflow-StepName": step.stepName,
        "Upstash-Callback-Forward-Upstash-Workflow-StepType": step.stepType,
        "Upstash-Callback-Forward-Upstash-Workflow-Concurrent": step.concurrent.toString(),
        "Upstash-Callback-Forward-Upstash-Workflow-ContentType":
          contentType ?? DEFAULT_CONTENT_TYPE,
        // "Upstash-Workflow-Id": this.workflowId,
        "Upstash-Workflow-CallType": "toCallback",
        // upstashHeader.Set(InitHeader, "false")
        ...forwardedHeaders,
      };
    }

    return baseHeaders;
  }
}
