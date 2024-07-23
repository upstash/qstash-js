import type { Client } from "../client";
import type { WorkflowContext } from "./context";

export type StepType = "Initial" | "Run" | "SleepFor" | "SleepUntil";

export type Step<TResult = unknown> = {
  stepId: number;
  stepName: string;
  stepType: StepType;
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

export type WorkflowServeParameters<TInitialPayload, TResponse = Response> = {
  routeFunction: (context: WorkflowContext<TInitialPayload>) => Promise<void>;
  options?: WorkflowServeOptions<TResponse, TInitialPayload>;
};

/**
 * Not all frameworks use env variables like nextjs does. In this case, we need
 * to be able to get the client explicitly.
 *
 * In this case, we extend the WorkflowServeParameters by requiring an explicit
 * client parameter and removing client from options.
 */
export type WorkflowServeParametersWithClient<
  TInitialPayload = unknown,
  TResponse = Response,
> = Pick<WorkflowServeParameters<TInitialPayload, TResponse>, "routeFunction"> & {
  client: Client;
  options?: Omit<WorkflowServeOptions<TResponse, TInitialPayload>, "client">;
};

/**
 * Function parsing initial payload from string to an object
 */
export type InitialPayloadParser<TInitialPayload = unknown> = (
  initialPayload: string
) => TInitialPayload;

export type WorkflowServeOptions<TResponse = Response, TInitialPayload = unknown> = {
  /**
   * QStash client
   */
  client?: Client;
  /**
   * Function called to return a response after each step execution
   *
   * @param workflowId
   * @returns response
   */
  onStepFinish?: (workflowId: string) => TResponse;
  /**
   * Function to parse the initial payload passed by the user
   */
  initialPayloadParser?: InitialPayloadParser<TInitialPayload>;
};
