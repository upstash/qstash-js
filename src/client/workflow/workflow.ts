import { nanoid } from "nanoid";
import type { AsyncStepFunction, ParallelCallState, Step } from "./types";
import { WORKFLOW_INTERNAL_HEADER, WORKFLOW_ID_HEADER } from "./constants";
import type { Client } from "../client";
import * as WorkflowParser from "./workflow-parser";
import { AutoExecutor } from "./auto-executor";
import { QstashWorkflowError } from "../error";

export class Workflow<TInitialRequest = unknown> {
  protected readonly client: Client;
  protected executor: AutoExecutor;
  protected pendingSteps: Step[] = [];

  protected readonly url: string;
  protected readonly steps: Step[];
  protected readonly workflowId: string;
  protected readonly nonPlanStepCount: number;
  protected skip;

  // counters which are incremented as steps are processed
  protected stepCount = 0;
  protected planStepCount = 0;

  public requestPayload: TInitialRequest;

  /**
   * Creates a workflow context which offers methods to run steps
   * in parallel and by themselves
   *
   * @param client QStash client
   * @param url QStash backend url
   * @param workflowId Id of the workflow
   * @param steps steps received from QStash
   * @param skip whether the steps in the workflow should be skipped
   */
  constructor({
    client,
    url,
    workflowId,
    steps,
    skip = false,
  }: {
    client: Client;
    url: string;
    workflowId: string;
    steps: Step[];
    skip: boolean;
  }) {
    this.client = client;
    this.url = url;
    this.workflowId = workflowId;
    this.steps = steps;
    this.nonPlanStepCount = this.steps.filter((step) => !step.targetStep).length;
    this.skip = skip;
    this.executor = new AutoExecutor(this);
    this.requestPayload = this.steps[0].out as TInitialRequest;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    stepName: string,
    stepFunction: AsyncStepFunction<TResult>
  ): Promise<TResult> {
    this.stepCount += 1;
    if (this.skip) {
      // @ts-expect-error return undefined for skipped steps
      return;
    }

    const result = await this.executor.addStep(stepFunction);

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
  public async runStep<TResult>(step: AsyncStepFunction<TResult>) {
    if (this.stepCount < this.nonPlanStepCount) {
      return this.steps[this.stepCount + this.planStepCount].out as TResult;
    }

    const result = await step();

    // add result to pending and send request
    this.addResult(result);
    await this.sendPendingToQstash();
    this.skip = true;

    return result;
  }

  /**
   * Runs steps in parallel.
   *
   * @param stepName parallel step name
   * @param stepFunctions list of async functions to run in parallel
   * @returns results of the functions run in parallel
   */
  public async parallel<TResults extends unknown[]>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    stepName: string,
    stepFunctions: { [K in keyof TResults]: AsyncStepFunction<TResults[K]> }
  ): Promise<TResults> {
    const initialStepCount = this.stepCount - (stepFunctions.length - 1);
    const parallelCallState = this.getParallelCallState(stepFunctions.length, initialStepCount);

    switch (parallelCallState) {
      case "first": {
        const planSteps = stepFunctions.map((stepFunction, index) => {
          return {
            stepId: 0,
            concurrent: stepFunctions.length,
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
        const rawResult = stepFunctions[stepIndex]();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = rawResult instanceof Promise ? await rawResult : rawResult;
        this.addResult(result, planStep.targetStep);
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
          .slice(0, stepFunctions.length) as TResults;
        this.planStepCount += stepFunctions.length;
        return concurrentResults;
      }
    }
    await this.sendPendingToQstash();
    this.skip = true;

    const fillValue = undefined;
    return Array.from({ length: stepFunctions.length }).fill(fillValue) as TResults;
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

  private addResult(result: unknown, stepId?: number) {
    this.addStep({
      stepId: stepId ?? this.stepCount,
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

  private async submitResults(step: Step) {
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
    this.pendingSteps = [];
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
   * @returns
   */
  static async createWorkflow<TInitialRequest = unknown>(request: Request, client: Client) {
    const { isFirstInvocation, workflowId, steps } = await Workflow.parseRequest(request);
    const workflow = new Workflow<TInitialRequest>({
      client,
      workflowId,
      steps,
      skip: isFirstInvocation,
      url: request.url,
    });

    if (isFirstInvocation) {
      await workflow.submitResults(steps[0]);
    } else {
      // TODO: verify that request is coming from QStash
    }

    return workflow;
  }
}
