import { nanoid } from "nanoid";
import type { AsyncStepFunction, PARALLEL_CALL_STATE, Step, StepFunction } from "./types";
import { internalHeader, workflowIdHeader } from "./types";
import type { Client } from "../client";

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
  }

  public requestPayload() {
    return this.steps[0].out;
  }

  public async run<TResult>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    stepName: string,
    stepFunction: StepFunction<TResult>
  ): Promise<TResult> {
    this.stepCount += 1;
    if (this.skip) {
      // @ts-expect-error return undefined for skipped steps
      return;
    }

    if (this.stepCount < this.nonPlanStepCount) {
      return this.steps[this.stepCount + this.planStepCount].out as TResult;
    }

    const rawResult = stepFunction();
    const result = rawResult instanceof Promise ? await rawResult : rawResult;
    this.skip = true;

    // add result to pending and send request
    this.addResult(result);
    await this.sendPendingToQstash();

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
    this.stepCount += 1;
    if (this.skip) {
      return [] as unknown as TResults;
    }
    const parallelCallState = this.getParallelCallState(stepFunctions.length);

    switch (parallelCallState) {
      case "first": {
        const planSteps = stepFunctions.map((stepFunction, index) => {
          return {
            stepId: 0,
            concurrent: stepFunctions.length,
            targetStep: this.stepCount + index,
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
        const stepIndex = planStep.targetStep - this.stepCount;
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
          .filter((step) => step.stepId >= this.stepCount)
          .map((step) => step.out)
          .slice(0, stepFunctions.length) as TResults;
        this.stepCount += stepFunctions.length - 1;
        this.planStepCount += stepFunctions.length;
        return concurrentResults;
      }
    }
    await this.sendPendingToQstash();
    this.skip = true;
    return [] as unknown as TResults;
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
  protected getParallelCallState(parallelStepCount: number): PARALLEL_CALL_STATE {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (this.steps.length >= this.stepCount + this.planStepCount + 2 * parallelStepCount) {
      return "last";
    } else if (this.steps.at(-1)?.stepId === 0) {
      return "partial";
    } else if (this.stepCount === this.nonPlanStepCount) {
      return "first";
    } else {
      // last one is a result step, discard
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
      this.pendingSteps = [...this.pendingSteps, ...step];
    } else {
      this.pendingSteps.push(step);
    }
  }

  private async invokeQstash(step: Step) {
    const headers: Record<string, string> = {
      [`Upstash-Forward-${internalHeader}`]: "yes",
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
      await this.invokeQstash(step);
    }
    this.pendingSteps = [];
  }

  /**
   * STATIC METHODS
   */

  static async parseRequest(request: Request) {
    const callHeader = request.headers.get(internalHeader);
    const firstCall = !callHeader;

    const workflowId = firstCall ? `wf${nanoid()}` : request.headers.get(workflowIdHeader) ?? "";
    if (workflowId.length === 0) {
      throw new Error("Couldn't get workflow id from header");
    }

    let payload: string[] | undefined;
    try {
      payload = (await request.json()) as string[];
    } catch {
      payload = undefined;
    }

    let steps: Step[];
    if (firstCall) {
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

      steps = payload.map((rawStep) => {
        return JSON.parse(JSON.parse(Buffer.from(rawStep, "base64").toString()) as string) as Step;
      });
    }

    return {
      firstCall,
      workflowId,
      steps,
    };
  }

  static async createWorkflow(request: Request, client: Client) {
    const { firstCall, workflowId, steps } = await Workflow.parseRequest(request);
    const workflow = new Workflow({ client, workflowId, steps, skip: firstCall, url: request.url });

    if (firstCall) {
      await workflow.invokeQstash(steps[0]);
    }

    return workflow;
  }
}
