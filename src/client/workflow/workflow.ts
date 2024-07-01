import { nanoid } from "nanoid";
import type { AsyncStepFunction, ParallelCallState, Step } from "./types";
import { WORKFLOW_INTERNAL_HEADER, WORKFLOW_ID_HEADER } from "./constants";
import type { Client } from "../client";
import * as WorkflowParser from "./workflow-parser";
import { AutoExecutor } from "./auto-executor";

export class Workflow {
  protected readonly client: Client;
  protected readonly url: string;
  protected stepCount = 0;
  protected planStepCount = 0;
  protected readonly workflowId: string;
  protected readonly steps: Step[];
  protected readonly nonPlanStepCount: number;
  protected skip;
  // to accumulate steps in Promise.all
  protected pendingSteps: Step[] = [];
  private executor: AutoExecutor;

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
  }

  public requestPayload() {
    return this.steps[0].out;
  }

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

    return result;
  }

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
   *
   *
   * @param stepName
   * @param stepFunctions
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
          throw new Error(
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
   * Parallel can be called in three states:
   * 1. Called for the first time: will send the three plans to qstash one by one
   * 2. Called with partial results: after the initial call, will be called multiple
   *    times with each call having a unique targetStep. Corresponding target step
   *    will be executed
   * 3. Called with full results: After the final partial result call returns to Qstash,
   *    qstash will call again with the full result. In this case, parallel step will
   *    return the result and
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

  static async parseRequest(request: Request) {
    const callHeader = request.headers.get(WORKFLOW_INTERNAL_HEADER);
    const isFirstInvocation = !callHeader;

    const workflowId = isFirstInvocation
      ? `wf${nanoid()}`
      : request.headers.get(WORKFLOW_ID_HEADER) ?? "";
    if (workflowId.length === 0) {
      throw new Error("Couldn't get workflow id from header");
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
        throw new Error("only first call can have an empty body");
      }

      steps = WorkflowParser.generateSteps(payload);
    }

    return {
      isFirstInvocation,
      workflowId,
      steps,
    };
  }

  static async createWorkflow(request: Request, client: Client) {
    const { isFirstInvocation, workflowId, steps } = await Workflow.parseRequest(request);
    const workflow = new Workflow({
      client,
      workflowId,
      steps,
      skip: isFirstInvocation,
      url: request.url,
    });

    if (isFirstInvocation) {
      await workflow.submitResults(steps[0]);
    }

    return workflow;
  }
}
