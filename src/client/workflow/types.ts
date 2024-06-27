export type Step<TOut = unknown> = {
  stepId: number;
  out?: TOut;
  sleepFor?: number;
  sleepUntil?: number;
  concurrent: number;
  targetStep: number;
};

/**
 * Context received from Qstash
 */
export type ContextPayload<TOut> = {
  steps: Step<TOut>[];
  concurrentStep: number;
  targetStep: number;
};

export type SyncStepFunction<TResult> = () => TResult;
export type AsyncStepFunction<TResult> = () => Promise<TResult>;
export type StepFunction<TResult> = AsyncStepFunction<TResult> | SyncStepFunction<TResult>;

export const workflowIdHeader = "Upstash-Workflow-Id";
export const internalHeader = "Upstash-Workflow-InternalCall";

export type PARALLEL_CALL_STATE = "first" | "partial" | "discard" | "last";
