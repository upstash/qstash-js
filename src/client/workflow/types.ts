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

export type StepFunction<TResult> = () => Promise<TResult>;

export const workflowIdHeader = "Upstash-Workflow-Id";
export const internalHeader = "Upstash-Workflow-InternalCall";
