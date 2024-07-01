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
        throw new Error(
          `unexpected parallel call result: '${result}'. Expected ${functionList.length} many items`
        );
      }
      return result[index] as TOut;
    } else {
      throw new Error("error processing the executor response");
    }
  }

  private async deferExecution() {
    await Promise.resolve();
    await Promise.resolve();
  }
}
