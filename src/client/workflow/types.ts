import type { Client } from "../client";
import type { WorkflowContext } from "./context";

export type Step<TResult = unknown> = {
  stepId: number;
  stepName: string;
  out?: TResult;
  sleepFor?: number;
  sleepUntil?: number;
  concurrent: number;
  targetStep: number;
};

export type StepInfo<TResult> = {
  stepName: string;
  stepFunction: AsyncStepFunction<TResult>;
};

/**
 * Context received from Qstash
 */
export type ContextPayload<TResult> = {
  steps: Step<TResult>[];
  concurrentStep: number;
  targetStep: number;
};

export type SyncStepFunction<TResult> = () => TResult;
export type AsyncStepFunction<TResult> = () => Promise<TResult>;
export type StepFunction<TResult> = AsyncStepFunction<TResult> | SyncStepFunction<TResult>;

export type ParallelCallState = "first" | "partial" | "discard" | "last";

export type WorkflowServeParameters<TPayload, TResponse extends Response = Response> = {
  routeFunction: (context: WorkflowContext<TPayload>) => Promise<void>;
  options?: WorkflowServeOptions<TResponse>;
};

export type WorkflowServeOptions<TResponse extends Response = Response> = {
  client?: Client;
  onFinish?: (workflowId: string) => TResponse;
};

/**
 *
 */
export abstract class BaseLazyStep<TResult = unknown> {
  public readonly stepName;
  constructor(stepName: string) {
    this.stepName = stepName;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    return {
      stepId: 0,
      stepName: this.stepName,
      concurrent,
      targetStep,
    };
  }

  public abstract getResultStep(stepId: number): Promise<Step<TResult>>;
}

export class LazyFunctionStep<TResult = unknown> extends BaseLazyStep<TResult> {
  private readonly stepFunction: AsyncStepFunction<TResult>;

  constructor(stepName: string, stepFunction: AsyncStepFunction<TResult>) {
    super(stepName);
    this.stepFunction = stepFunction;
  }

  public async getResultStep(stepId: number): Promise<Step<TResult>> {
    const result = await this.stepFunction();

    return {
      stepId,
      stepName: this.stepName,
      out: result,
      concurrent: 1,
      targetStep: 0,
    };
  }
}

export class LazySleepStep extends BaseLazyStep {
  private readonly sleep: number;

  constructor(stepName: string, sleep: number) {
    super(stepName);
    this.sleep = sleep;
  }
  public async getResultStep(stepId: number): Promise<Step> {
    return await Promise.resolve({
      stepId,
      stepName: this.stepName,
      sleepFor: this.sleep,
      concurrent: 1,
      targetStep: 0,
    });
  }
}

export class LazySleepUntilStep extends BaseLazyStep {
  private readonly sleepUntil: number;

  constructor(stepName: string, sleepUntil: number) {
    super(stepName);
    this.sleepUntil = sleepUntil;
  }
  public async getResultStep(stepId: number): Promise<Step> {
    return await Promise.resolve({
      stepId,
      stepName: this.stepName,
      sleepUntil: this.sleepUntil,
      concurrent: 1,
      targetStep: 0,
    });
  }
}
