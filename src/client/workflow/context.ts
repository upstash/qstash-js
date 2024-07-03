import type { Workflow } from "./workflow";
import type { AsyncStepFunction } from "./types";

export class WorkflowContext<TInitialRequest = unknown> {
  private workflow: Workflow;
  public readonly requestPayload: TInitialRequest;

  constructor({ workflow }: { workflow: Workflow<TInitialRequest> }) {
    this.workflow = workflow;
    this.requestPayload = workflow.requestPayload;
  }

  public async run<TResult>(
    stepName: string,
    stepFunction: AsyncStepFunction<TResult>
  ): Promise<TResult> {
    return this.workflow.run(stepName, stepFunction);
  }

  // TODO add sleep/sleepFor
}
