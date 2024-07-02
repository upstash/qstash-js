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
