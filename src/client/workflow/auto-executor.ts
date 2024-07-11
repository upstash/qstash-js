import { QstashWorkflowAbort, QstashWorkflowError } from "../error";
import type { WorkflowContext } from "./context";
import type { AsyncStepFunction, ParallelCallState, Step } from "./types";
import { LazyFunctionStep, LazySleepStep, LazySleepUntilStep, type BaseLazyStep } from "./steps";

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

  /**
   * Adds a sleep step
   *
   * @param stepName
   * @param sleep duration to sleep in seconds
   * @returns
   */
  public async addSleepStep(stepName: string, sleep: number) {
    return await this.addStep(new LazySleepStep(stepName, sleep));
  }

  /**
   * Adds a sleepUntil step
   *
   * @param stepName
   * @param sleepUntil unix timestamp to wait until (in seconds)
   * @returns
   */
  public async addSleepUntilStep(stepName: string, sleepUntil: number) {
    return await this.addStep(new LazySleepUntilStep(stepName, sleepUntil));
  }

  /**
   * Adds an execution step
   *
   * @param stepName
   * @param stepFunction function to execute
   * @returns
   */
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
   * @param stepInfo step plan to add
   * @returns result of the step function
   */
  private async addStep<TResult>(stepInfo: BaseLazyStep<TResult>) {
    this.stepCount += 1;

    const lazyStepList = this.activeLazyStepList ?? [];

    if (!this.activeLazyStepList) {
      this.activeLazyStepList = lazyStepList;
      this.indexInCurrentList = 0;
    }

    lazyStepList.push(stepInfo);
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
   *
   * @param lazyStep lazy step to execute
   * @returns step result
   */
  private async runSingle<TResult>(lazyStep: BaseLazyStep<TResult>) {
    if (this.stepCount < this.context.nonPlanStepCount) {
      return this.context.steps[this.stepCount + this.planStepCount].out as TResult;
    }

    const resultStep = await lazyStep.getResultStep(this.stepCount, true);
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
    // get the step count before the parallel steps were added + 1
    const initialStepCount = this.stepCount - (parallelSteps.length - 1);
    const parallelCallState = this.getParallelCallState(parallelSteps.length, initialStepCount);

    switch (parallelCallState) {
      case "first": {
        /**
         * Encountering a parallel step for the first time, create plan steps for each parallel step
         * and send them to QStash. QStash will call us back parallelSteps.length many times
         */
        const planSteps = parallelSteps.map((parallelStep, index) =>
          parallelStep.getPlanStep(parallelSteps.length, initialStepCount + index)
        );
        await this.submitStepsToQstash(planSteps);
        break;
      }
      case "partial": {
        /**
         * Being called by QStash to run one of the parallel steps. Last step in the steps list
         * indicates which step is to be run
         *
         * Execute the step and call qstash with the result
         */
        const planStep = this.context.steps.at(-1);
        if (!planStep || planStep.targetStep === 0) {
          throw new QstashWorkflowError(
            `There must be a last step and it should have targetStep larger than 0. Received: ${JSON.stringify(planStep)}`
          );
        }
        const stepIndex = planStep.targetStep - initialStepCount;
        const resultStep = await parallelSteps[stepIndex].getResultStep(planStep.targetStep, false);
        await this.submitStepsToQstash([resultStep]);
        break;
      }
      case "discard": {
        /**
         * We are still executing a parallel step but the last step is not a plan step, which means the parallel
         * execution is in progress (other parallel steps are still running) but one of the parallel steps has
         * called QStash with its result.
         *
         * This call to the API should be discarded: no operations are to be made. Parallel steps which are still
         * running will finish and call QStash eventually.
         */
        throw new QstashWorkflowAbort("discarded parallel");
      }
      case "last": {
        /**
         * All steps of the parallel execution have finished.
         */
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
      // multipying by two since each step in parallel step will result in two
      // steps: one plan step and one result step. If there are 3 parallel steps
      // and steps list has at least 3*2=6 steps, the parallel steps have finished
      return "last";
    } else if (remainingSteps.at(-1)?.targetStep) {
      // if the last step is a plan step, it means the step corresponding to the
      // plan step will execute
      return "partial";
    } else {
      // if the call is not the first/last/partial, it means that it's the result
      // of one of the parallel calls but others are still running, meaning that
      // the current call should be discarded
      return "discard";
    }
  }

  /**
   * sends the steps to QStash as batch
   *
   * @param steps steps to send
   */
  private async submitStepsToQstash(steps: Step[]) {
    // if there are no steps, something went wrong. Raise exception
    if (steps.length === 0) {
      throw new QstashWorkflowError(
        `Unable to submit steps to Qstash. Provided list is empty. Current step: ${this.stepCount}`
      );
    }

    await this.context.client.batchJSON(
      steps.map((singleStep) => {
        return {
          headers: this.context.getHeaders("false"),
          method: "POST",
          body: JSON.stringify(singleStep),
          url: this.context.url,
          notBefore: singleStep.sleepUntil,
          delay: singleStep.sleepFor,
        };
      })
    );

    // if the steps are sent successfully, abort to stop the current request
    throw new QstashWorkflowAbort(steps[0].stepName, steps[0]);
  }

  /**
   * Get the promise by executing the lazt steps list. If there is a single
   * step, we call `runSingle`. Otherwise `runParallel` is called.
   *
   * @param lazyStepList steps list to execute
   * @returns promise corresponding to the execution
   */
  private getExecutionPromise(lazyStepList: BaseLazyStep[]): Promise<unknown> {
    return lazyStepList.length === 1
      ? this.runSingle(lazyStepList[0])
      : this.runParallel(lazyStepList);
  }

  /**
   * @param lazyStepList steps we executed
   * @param result result of the promise from `getExecutionPromise`
   * @param index index of the current step
   * @returns result[index] if lazyStepList > 1, otherwise result
   */
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
