import { QstashWorkflowError } from "../error";
import type { AsyncStepFunction } from "./types";
import type { Workflow } from "./workflow";

export class AutoExecutor {
  private promises = new WeakMap<AsyncStepFunction<unknown>[], Promise<unknown>>();
  private activeFunctionList?: AsyncStepFunction<unknown>[];
  private indexInCurrentList = 0;

  private workflow: Workflow;

  constructor(workflow: Workflow) {
    this.workflow = workflow;
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
  public async addStep<TOut>(asyncStepFunction: AsyncStepFunction<TOut>) {
    const functionList = this.activeFunctionList ?? [];

    if (!this.activeFunctionList) {
      this.activeFunctionList = functionList;
      this.indexInCurrentList = 0;
    }

    functionList.push(asyncStepFunction);
    const index = this.indexInCurrentList++;

    const requestComplete = this.deferExecution().then(async () => {
      if (!this.promises.has(functionList)) {
        const promise =
          functionList.length === 1
            ? this.workflow.runStep(functionList[0])
            : this.workflow.parallel("parallel with Promise.all", functionList);

        this.promises.set(functionList, promise);
        this.activeFunctionList = undefined;
      }
      const promise = this.promises.get(functionList);
      return promise;
    });

    const result = await requestComplete;
    if (functionList.length === 1) {
      return result as TOut;
    } else if (functionList.length > 0 && Array.isArray(result)) {
      if (result.length !== functionList.length) {
        throw new QstashWorkflowError(
          `Unexpected parallel call result: '${result}'. Expected ${functionList.length} many items`
        );
      }
      return result[index] as TOut;
    } else {
      `Unexpected parallel call result: '${result}'. Expected ${functionList.length} many items`;
    }
  }

  private async deferExecution() {
    await Promise.resolve();
    await Promise.resolve();
  }
}
