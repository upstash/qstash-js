import { QstashWorkflowAbort, QstashWorkflowError } from "../error";
import type { WorkflowContext } from "./context";
import type { ParallelCallState, Step } from "./types";
import { type BaseLazyStep } from "./steps";
import { getHeaders } from "./workflow-requests";
import type { WorkflowLogger } from "./logger";

export class AutoExecutor {
  private context: WorkflowContext;
  private promises = new WeakMap<BaseLazyStep[], Promise<unknown>>();
  private activeLazyStepList?: BaseLazyStep[];
  private debug?: WorkflowLogger;

  private indexInCurrentList = 0;
  public stepCount = 0;
  public planStepCount = 0;

  constructor(context: WorkflowContext, debug?: WorkflowLogger) {
    this.context = context;
    this.debug = debug;
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
  public async addStep<TResult>(stepInfo: BaseLazyStep<TResult>) {
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
  protected async runSingle<TResult>(lazyStep: BaseLazyStep<TResult>) {
    if (this.stepCount < this.context.nonPlanStepCount) {
      const step = this.context.steps[this.stepCount + this.planStepCount];
      validateStep(lazyStep, step);
      await this.debug?.log("INFO", "RUN_SINGLE", {
        fromRequest: true,
        step,
        stepCount: this.stepCount,
      });
      return step.out as TResult;
    }

    const resultStep = await lazyStep.getResultStep(this.stepCount, true);

    await this.debug?.log("INFO", "RUN_SINGLE", {
      fromRequest: false,
      step: resultStep,
      stepCount: this.stepCount,
    });
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
  protected async runParallel<TResults extends unknown[]>(parallelSteps: {
    [K in keyof TResults]: BaseLazyStep<TResults[K]>;
  }): Promise<TResults> {
    // get the step count before the parallel steps were added + 1
    // so if there are two initial steps followed by a parallel step,
    // initialStepCount would be 3.
    const initialStepCount = this.stepCount - (parallelSteps.length - 1);
    const parallelCallState = this.getParallelCallState(parallelSteps.length, initialStepCount);

    const sortedSteps = sortSteps(this.context.steps);

    // get the expected concurrency. Will be undefined in the `first` case.
    const plannedParallelStepCount = sortedSteps[initialStepCount + this.planStepCount]?.concurrent;

    if (parallelCallState !== "first" && plannedParallelStepCount !== parallelSteps.length) {
      // user has added/removed a parallel step
      throw new QstashWorkflowError(
        `Incompatible number of parallel steps when call state was '${parallelCallState}'.` +
          ` Expected ${parallelSteps.length}, got ${plannedParallelStepCount} from the request.`
      );
    }

    await this.debug?.log("INFO", "RUN_PARALLEL", {
      parallelCallState,
      initialStepCount,
      plannedParallelStepCount,
      stepCount: this.stepCount,
      planStepCount: this.planStepCount,
    });

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
            `There must be a last step and it should have targetStep larger than 0.` +
              `Received: ${JSON.stringify(planStep)}`
          );
        }
        const stepIndex = planStep.targetStep - initialStepCount;

        // even though we check for differences in the `last` case, we still need to check
        // here because it's not possible to detect name/type changes in sleep/sleepUntil
        // steps if we don't check here. This is because we wait after submitting the plan
        // step which has the _original step_ name/type but use the 'changed' step name/type
        // when submitting the _result step_.

        // So in the 'last' case it's not possible to detect step name/type changes for
        // sleep/sleepUntil. It's only possible here:
        validateStep(parallelSteps[stepIndex], planStep);
        try {
          const resultStep = await parallelSteps[stepIndex].getResultStep(
            planStep.targetStep,
            false
          );
          await this.submitStepsToQstash([resultStep]);
        } catch (error) {
          if (error instanceof QstashWorkflowAbort) {
            throw error;
          }
          throw new QstashWorkflowError(
            `Error submitting steps to qstash in partial parallel step execution: ${error}`
          );
        }
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
         *
         * validate the results and return them
         */

        const parallelResultSteps = sortedSteps
          .filter((step) => step.stepId >= initialStepCount) // filter out plan steps
          .slice(0, parallelSteps.length); // get the result steps of parallel run

        validateParallelSteps(parallelSteps, parallelResultSteps);

        return parallelResultSteps.map((step) => step.out) as TResults;
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

    await this.debug?.log("SUBMIT", "SUBMIT_STEP", { length: steps.length, steps });

    const result = await this.context.client.batchJSON(
      steps.map((singleStep) => {
        const headers = getHeaders(
          "false",
          this.context.workflowRunId,
          this.context.url,
          this.context.headers,
          singleStep
        );
        return singleStep.callUrl
          ? // if the step is a third party call, we call the third party
            // url (singleStep.callUrl) and pass information about the workflow
            // in the headers (handled in getHeaders). QStash makes the request
            // to callUrl and returns the result to Workflow endpoint.
            // handleThirdPartyCallResult method sends the result of the third
            // party call to QStash.
            {
              headers,
              method: singleStep.callMethod,
              body: singleStep.callBody,
              url: singleStep.callUrl,
            }
          : // if the step is not a third party call, we use workflow
            // endpoint (context.url) as URL when calling QStash. QStash
            // calls us back with the updated steps list.
            {
              headers,
              method: "POST",
              body: singleStep,
              url: this.context.url,
              notBefore: singleStep.sleepUntil,
              delay: singleStep.sleepFor,
            };
      })
    );

    await this.debug?.log("INFO", "SUBMIT_STEP", {
      messageIds: result.map((message) => {
        return {
          message: message.messageId,
        };
      }),
    });

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

/**
 * Given a BaseLazyStep which is created during execution and a Step parsed
 * from the incoming request; compare the step names and types to make sure
 * that they are the same.
 *
 * Raises `QstashWorkflowError` if there is a difference.
 *
 * @param lazyStep lazy step created during execution
 * @param stepFromRequest step parsed from incoming request
 */
const validateStep = (lazyStep: BaseLazyStep, stepFromRequest: Step): void => {
  // check step name
  if (lazyStep.stepName !== stepFromRequest.stepName) {
    throw new QstashWorkflowError(
      `Incompatible step name. Expected ${lazyStep.stepName},` +
        ` got ${stepFromRequest.stepName} from the request`
    );
  }
  // check type name
  if (lazyStep.stepType !== stepFromRequest.stepType) {
    throw new QstashWorkflowError(
      `Incompatible step type. Expected ${lazyStep.stepType},` +
        ` got ${stepFromRequest.stepType} from the request`
    );
  }
};

/**
 * validates that each lazy step and step from request has the same step
 * name and type using `validateStep` method.
 *
 * If there is a difference, raises `QstashWorkflowError` with information
 * about the difference.
 *
 * @param lazySteps list of lazy steps created during parallel execution
 * @param stepsFromRequest list of steps corresponding to the parallel execution
 */
const validateParallelSteps = (lazySteps: BaseLazyStep[], stepsFromRequest: Step[]): void => {
  try {
    for (const [index, stepFromRequest] of stepsFromRequest.entries()) {
      validateStep(lazySteps[index], stepFromRequest);
    }
  } catch (error) {
    if (error instanceof QstashWorkflowError) {
      const lazyStepNames = lazySteps.map((lazyStep) => lazyStep.stepName);
      const lazyStepTypes = lazySteps.map((lazyStep) => lazyStep.stepType);
      const requestStepNames = stepsFromRequest.map((step) => step.stepName);
      const requestStepTypes = stepsFromRequest.map((step) => step.stepType);
      throw new QstashWorkflowError(
        `Incompatible steps detected in parallel execution: ${error.message}` +
          `\n  > Step Names from the request: ${requestStepNames}` +
          `\n    Step Types from the request: ${requestStepTypes}` +
          `\n  > Step Names expected: ${lazyStepNames}` +
          `\n    Step Types expected: ${lazyStepTypes}`
      );
    }
    throw error;
  }
};

/**
 * Given a set of steps, sorts them according to their `stepId`s. For plan steps,
 * `targetStep` field is used
 *
 * @param steps list of steps
 * @returns sorted steps
 */
const sortSteps = (steps: Step[]): Step[] => {
  const getStepId = (step: Step) => (step.stepId === 0 ? step.targetStep : step.stepId);
  return steps.toSorted((step, stepOther) => getStepId(step) - getStepId(stepOther));
};
