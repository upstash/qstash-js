import { nanoid } from "nanoid";
import type { AsyncStepFunction, ParallelCallState, StepInfo, Step } from "./types";
import { WORKFLOW_INTERNAL_HEADER, WORKFLOW_ID_HEADER } from "./constants";
import type { Client } from "../client";
import * as WorkflowParser from "./workflow-parser";
import { AutoExecutor } from "./auto-executor";
import { QstashWorkflowAbort, QstashWorkflowError } from "../error";

export class Workflow {
  protected readonly client: Client;
  protected executor: AutoExecutor;
  protected pendingSteps: Step[] = [];

  protected readonly url: string;
  protected readonly nonPlanStepCount: number;

  public readonly steps: Step[];
  public readonly workflowId: string;

  /**
   * Creates a workflow context which offers methods to run steps
   * in parallel and by themselves
   *
   * @param client QStash client
   * @param url QStash backend url
   * @param workflowId Id of the workflow
   * @param steps steps received from QStash
   */
  constructor({
    client,
    url,
    workflowId,
    steps,
  }: {
    client: Client;
    url: string;
    workflowId: string;
    steps: Step[];
  }) {
    this.client = client;
    this.url = url;
    this.workflowId = workflowId;
    this.steps = steps;
    this.nonPlanStepCount = this.steps.filter((step) => !step.targetStep).length;
    this.executor = new AutoExecutor(this);
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
   * - Increments `this.stepCount` by 1.
   * - Then, if a step was executed previously in the current run, rest of the
   *   steps are skipped.
   * - Adds the step to the executor
   * - Returns the result of the step
   *
   * @param stepName name of the step
   * @param stepFunction async step function to be executed
   * @returns result of the step function
   */
  public async run<TResult>(
    stepName: string,
    stepFunction: AsyncStepFunction<TResult>
  ): Promise<TResult> {
    const result = await this.executor.addStep({
      stepName,
      stepFunction,
    });

    return result as TResult;
  }

  /**
   * Executes a step:
   * - If the step result is available in the steps, returns the result
   * - If the result is not avaiable, runs the function
   * - Sends the result to QStash
   * - skips rest of the steps in the workflow in the current call
   *
   * @param step runs a step by itself
   * @returns step result
   */
  public async runSingle<TResult>(stepInfo: StepInfo<TResult>) {
    if (this.executor.stepCount < this.nonPlanStepCount) {
      return this.steps[this.executor.stepCount + this.executor.planStepCount].out as TResult;
    }

    const result = await stepInfo.stepFunction();

    // add result to pending and send request
    this.addResult(result, this.executor.stepCount, stepInfo.stepName);
    await this.sendPendingToQstash();

    return result;
  }

  /**
   *
   * @param stepName
   * @param duration sleep duration in seconds
   */
  public async sleep(stepName: string, duration: number): Promise<void> {
    this.executor.stepCount += 1;
    if (this.executor.stepCount < this.nonPlanStepCount) return;

    this.addStep({
      stepId: this.executor.stepCount,
      stepName,
      sleepFor: duration,
      concurrent: 1,
      targetStep: 0,
    });
    await this.sendPendingToQstash();
  }

  /**
   *
   * @param stepName
   * @param datetime Date object to sleep until
   */
  public async sleepUntil(stepName: string, datetime: Date | string | number): Promise<void> {
    this.executor.stepCount += 1;
    if (this.executor.stepCount < this.nonPlanStepCount) return;

    let time: number;
    if (typeof datetime === "number") {
      time = datetime;
    } else {
      datetime = typeof datetime === "string" ? new Date(datetime) : datetime;
      // get unix seconds
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      time = Math.round(datetime.getTime() / 1000);
    }

    this.addStep({
      stepId: this.executor.stepCount,
      stepName,
      sleepUntil: time,
      concurrent: 1,
      targetStep: 0,
    });
    await this.sendPendingToQstash();
  }

  /**
   * Runs steps in parallel.
   *
   * @param stepName parallel step name
   * @param stepFunctions list of async functions to run in parallel
   * @returns results of the functions run in parallel
   */
  public async runParallel<TResults extends unknown[]>(parallelSteps: {
    [K in keyof TResults]: StepInfo<TResults[K]>;
  }): Promise<TResults> {
    const initialStepCount = this.executor.stepCount - (parallelSteps.length - 1);
    const parallelCallState = this.getParallelCallState(parallelSteps.length, initialStepCount);

    switch (parallelCallState) {
      case "first": {
        const planSteps = parallelSteps.map((stepFunction, index) => {
          return {
            stepId: 0,
            stepName: stepFunction.stepName,
            concurrent: parallelSteps.length,
            targetStep: initialStepCount + index,
          } as Step;
        });
        this.addStep(planSteps);
        break;
      }
      case "partial": {
        const planStep = this.steps.at(-1);
        if (!planStep || planStep.targetStep === 0) {
          throw new QstashWorkflowError(
            `There must be a last step and it should have targetStep larger than 0. Received: ${JSON.stringify(planStep)}`
          );
        }
        const stepIndex = planStep.targetStep - initialStepCount;
        const rawResult = parallelSteps[stepIndex].stepFunction();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = rawResult instanceof Promise ? await rawResult : rawResult;
        this.addResult(result, planStep.targetStep, parallelSteps[stepIndex].stepName);
        break;
      }
      case "discard": {
        break;
      }
      case "last": {
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const sortedSteps = this.steps.toSorted(
          (step, stepOther) => step.stepId - stepOther.stepId
        );

        const concurrentResults = sortedSteps
          .filter((step) => step.stepId >= initialStepCount)
          .map((step) => step.out)
          .slice(0, parallelSteps.length) as TResults;
        return concurrentResults;
      }
    }
    await this.sendPendingToQstash();
    const fillValue = undefined;
    return Array.from({ length: parallelSteps.length }).fill(fillValue) as TResults;
  }

  /**
   * Determines the parallel call state
   *
   * First filters the steps to get the steps which are after `initialStepCount` parameter.
   *
   * Depending on the remaining steps, decides the parallel state:
   * - "first": If there are no steps
   * - "last" If there are equal to or more than `2 * parallelStepCount`. We multiply by two
   *   because each step in a parallel execution will have 2 steps: a plan step and a result
   *   step.
   * - "partial": If the last step is a plan step
   * - "discard": If the last step is not a plan step. This means that the parallel execution
   *   is in progress (there are still steps to run) and one step has finished and submitted
   *   its result to QStash
   *
   * @param parallelStepCount number of steps to run in parallel
   * @param initialStepCount steps after the parallel invocation
   * @returns parallel call state
   */
  protected getParallelCallState(
    parallelStepCount: number,
    initialStepCount: number
  ): ParallelCallState {
    const remainingSteps = this.steps.filter(
      (step) => (step.stepId === 0 ? step.targetStep : step.stepId) >= initialStepCount
    );

    if (remainingSteps.length === 0) {
      return "first";
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    } else if (remainingSteps.length >= 2 * parallelStepCount) {
      return "last";
    } else if (remainingSteps.at(-1)?.targetStep) {
      return "partial";
    } else {
      return "discard";
    }
  }

  private addResult(result: unknown, stepId: number, stepName: string) {
    this.addStep({
      stepId,
      stepName,
      out: result,
      concurrent: 1,
      targetStep: 0,
    });
  }

  private addStep(step: Step | Step[]) {
    if (Array.isArray(step)) {
      this.pendingSteps.push(...step);
    } else {
      this.pendingSteps.push(step);
    }
  }

  public async submitResults(step: Step) {
    const headers: Record<string, string> = {
      [`Upstash-Forward-${WORKFLOW_INTERNAL_HEADER}`]: "yes",
      "Upstash-Forward-Upstash-Workflow-Id": this.workflowId,
      "Upstash-Workflow-Id": this.workflowId,
    };

    await this.client.publishJSON({
      headers: headers,
      method: "POST",
      body: JSON.stringify(step),
      url: this.url,
      notBefore: step.sleepUntil,
      delay: step.sleepFor,
    });
  }

  private async sendPendingToQstash() {
    // TODO: batch request for concurrent requests
    for (const step of this.pendingSteps) {
      await this.submitResults(step);
    }

    const error =
      this.pendingSteps.length > 0
        ? new QstashWorkflowAbort(this.pendingSteps[0].out, this.pendingSteps[0].stepName)
        : new QstashWorkflowAbort("discard", "discard"); // when parallel call returns "discard"
    throw error;
  }

  /**
   * Checks request headers and body
   * - Checks workflow header to determine whether the request is the first request
   * - Gets the workflow id
   * - Parses payload
   * - Returns the steps. If it's the first invocation, steps contains the initial step.
   *   Otherwise, steps are generated from the body.
   *
   * @param request Request received
   * @returns Whether the invocation is the initial one, the workflow id and the steps
   */
  static async parseRequest(request: Request) {
    const callHeader = request.headers.get(WORKFLOW_INTERNAL_HEADER);
    const isFirstInvocation = !callHeader;

    const workflowId = isFirstInvocation
      ? `wf${nanoid()}`
      : request.headers.get(WORKFLOW_ID_HEADER) ?? "";
    if (workflowId.length === 0) {
      throw new QstashWorkflowError("Couldn't get workflow id from header");
    }

    const payload = await WorkflowParser.parsePayload(request);

    let steps: Step[];
    if (isFirstInvocation) {
      steps = [
        {
          stepId: 0,
          stepName: "init",
          out: payload,
          concurrent: 1,
          targetStep: 0,
        },
      ];
    } else {
      if (payload === undefined) {
        throw new QstashWorkflowError("Only first call can have an empty body");
      }

      steps = WorkflowParser.generateSteps(payload);
    }

    return {
      isFirstInvocation,
      workflowId,
      steps,
    };
  }

  /**
   * Creates a workflow from a request by parsing the body and checking the
   * headers.
   *
   * @param request request received from the API
   * @param client QStash client
   * @returns workflow and whether its the first time the workflow is being called
   */
  static async createWorkflow(request: Request, client: Client) {
    const { isFirstInvocation, workflowId, steps } = await Workflow.parseRequest(request);
    const workflow = new Workflow({
      client,
      workflowId,
      steps,
      url: request.url,
    });

    return { workflow, isFirstInvocation };
  }
}
