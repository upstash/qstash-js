import { QstashWorkflowAbort, QstashWorkflowError } from "../error";
import { WORKFLOW_INTERNAL_HEADER } from "./constants";
import type { WorkflowContext } from "./context";
import type { ParallelCallState, Step } from "./types";
import {
  LazyFunctionStep,
  LazySleepStep,
  LazySleepUntilStep,
  type AsyncStepFunction,
  type BaseLazyStep,
} from "./types";

export class AutoExecutor {
  private context: WorkflowContext;
  private promises = new WeakMap<BaseLazyStep[], Promise<unknown>>();
  private activeLazyStepList?: BaseLazyStep[];

  private indexInCurrentList = 0;
  public stepCount = 0;
  public planStepCount = 0;

  constructor(context: WorkflowContext) {
    this.context = context;
  }

  public async addSleepStep(stepName: string, sleep: number) {
    return await this.addStep(new LazySleepStep(stepName, sleep));
  }
  public async addSleepUntilStep(stepName: string, sleepUntil: number) {
    return await this.addStep(new LazySleepUntilStep(stepName, sleepUntil));
  }
  public async addFunctionStep<TResult>(
    stepName: string,
    stepFunction: AsyncStepFunction<TResult>
  ) {
    return await this.addStep<TResult>(new LazyFunctionStep(stepName, stepFunction));
  }

  /**
   * Adds the step function to the list of step functions to run in
   * parallel. After adding the function, defers the execution, so
   * that if there is another step function to be added, it's also
   * added.
   *
   * After all functions are added, list of functions are executed.
   * If there is a single function, it's executed by itself. If there
   * are multiple, they are run in parallel.
   *
   * @param asyncStepFunction step function to run in parallel
   * @returns result of the step function
   */
  private async addStep<TResult>(StepInfo: BaseLazyStep<TResult>) {
    this.stepCount += 1;

    const lazyStepList = this.activeLazyStepList ?? [];

    if (!this.activeLazyStepList) {
      this.activeLazyStepList = lazyStepList;
      this.indexInCurrentList = 0;
    }

    lazyStepList.push(StepInfo);
    const index = this.indexInCurrentList++;

    const requestComplete = this.deferExecution().then(async () => {
      if (!this.promises.has(lazyStepList)) {
        const promise = this.getExecutionPromise(lazyStepList);
        this.promises.set(lazyStepList, promise);
        this.activeLazyStepList = undefined;

        // if there are more than 1 functions, increment the plan step count
        this.planStepCount += lazyStepList.length > 1 ? lazyStepList.length : 0;
      }
      const promise = this.promises.get(lazyStepList);
      return promise;
    });

    const result = await requestComplete;
    return AutoExecutor.getResult<TResult>(lazyStepList, result, index);
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
  private async runSingle<TResult>(lazyStep: BaseLazyStep<TResult>) {
    if (this.stepCount < this.context.nonPlanStepCount) {
      return this.context.steps[this.stepCount + this.planStepCount].out as TResult;
    }

    const resultStep = await lazyStep.getResultStep(this.stepCount);
    await this.submitStepsToQstash([resultStep]);

    return resultStep.out as TResult;
  }

  /**
   * Runs steps in parallel.
   *
   * @param stepName parallel step name
   * @param stepFunctions list of async functions to run in parallel
   * @returns results of the functions run in parallel
   */
  private async runParallel<TResults extends unknown[]>(parallelSteps: {
    [K in keyof TResults]: BaseLazyStep<TResults[K]>;
  }): Promise<TResults> {
    const initialStepCount = this.stepCount - (parallelSteps.length - 1);
    const parallelCallState = this.getParallelCallState(parallelSteps.length, initialStepCount);

    switch (parallelCallState) {
      case "first": {
        const planSteps = parallelSteps.map((parallelStep, index) =>
          parallelStep.getPlanStep(parallelSteps.length, initialStepCount + index)
        );
        await this.submitStepsToQstash(planSteps);
        break;
      }
      case "partial": {
        const planStep = this.context.steps.at(-1);
        if (!planStep || planStep.targetStep === 0) {
          throw new QstashWorkflowError(
            `There must be a last step and it should have targetStep larger than 0. Received: ${JSON.stringify(planStep)}`
          );
        }
        const stepIndex = planStep.targetStep - initialStepCount;
        const resultStep = await parallelSteps[stepIndex].getResultStep(planStep.targetStep);
        await this.submitStepsToQstash([resultStep]);
        break;
      }
      case "discard": {
        throw new QstashWorkflowAbort("discarded parallel");
      }
      case "last": {
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const sortedSteps = this.context.steps.toSorted(
          (step, stepOther) => step.stepId - stepOther.stepId
        );

        const concurrentResults = sortedSteps
          .filter((step) => step.stepId >= initialStepCount)
          .map((step) => step.out)
          .slice(0, parallelSteps.length) as TResults;
        return concurrentResults;
      }
    }
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
    const remainingSteps = this.context.steps.filter(
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

  public async submitStep(step: Step) {
    const headers: Record<string, string> = {
      [`Upstash-Forward-${WORKFLOW_INTERNAL_HEADER}`]: "yes",
      "Upstash-Forward-Upstash-Workflow-Id": this.context.workflowId,
      "Upstash-Workflow-Id": this.context.workflowId,
    };

    await this.context.client.publishJSON({
      headers: headers,
      method: "POST",
      body: JSON.stringify(step),
      url: this.context.url,
      notBefore: step.sleepUntil,
      delay: step.sleepFor,
    });
  }

  private async submitStepsToQstash(steps: Step[]) {
    // TODO: batch request for concurrent requests
    for (const step of steps) {
      await this.submitStep(step);
    }

    const error =
      steps.length > 0
        ? new QstashWorkflowAbort(steps[0].stepName, steps[0])
        : new QstashWorkflowError(
            `Unable to submit steps to Qstash. Provided list is empty. Current step: ${this.stepCount}`
          );
    throw error;
  }

  private getExecutionPromise(lazyStepList: BaseLazyStep[]): Promise<unknown> {
    return lazyStepList.length === 1
      ? this.runSingle(lazyStepList[0])
      : this.runParallel(lazyStepList);
  }

  private static getResult<TResult>(lazyStepList: BaseLazyStep[], result: unknown, index: number) {
    if (lazyStepList.length === 1) {
      return result as TResult;
    } else if (
      Array.isArray(result) &&
      lazyStepList.length === result.length &&
      index < lazyStepList.length
    ) {
      return result[index] as TResult;
    } else {
      throw new QstashWorkflowError(
        `Unexpected parallel call result while executing step ${index}: '${result}'. Expected ${lazyStepList.length} many items`
      );
    }
  }

  private async deferExecution() {
    await Promise.resolve();
    await Promise.resolve();
  }
}
