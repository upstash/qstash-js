import type { Workflow } from "./workflow";
import type { AsyncStepFunction } from "./types";

export class WorkflowContext<TInitialRequest = unknown> {
  private workflow: Workflow;
  /**
   * Initial payload passed in the first request to the workflow
   */
  public readonly requestPayload: TInitialRequest;

  constructor({
    workflow,
    requestPayload,
  }: {
    workflow: Workflow;
    requestPayload: TInitialRequest;
  }) {
    this.workflow = workflow;
    this.requestPayload = requestPayload;
  }

  /**
   * Executes a workflow step
   *
   * ```typescript
   * const result = context.run("step 1", async () => {
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
    return this.workflow.run(stepName, stepFunction);
  }

  /**
   * Stops the execution for the duration provided.
   *
   * @param stepName
   * @param duration sleep duration in seconds
   * @returns
   */
  public async sleep(stepName: string, duration: number): Promise<void> {
    return this.workflow.sleep(stepName, duration);
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
    return this.workflow.sleepUntil(stepName, datetime);
  }
}
