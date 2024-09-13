import type { Receiver } from "../../receiver";
import type { Client } from "../client";
import type { HTTPMethods } from "../types";
import type { WorkflowContext } from "./context";
import type { WorkflowLogger } from "./logger";

/**
 * Interface for Client with required methods
 *
 * Neeeded to resolve import issues
 */
export type WorkflowClient = {
  batchJSON: InstanceType<typeof Client>["batchJSON"];
  publishJSON: InstanceType<typeof Client>["publishJSON"];
  http: InstanceType<typeof Client>["http"];
};
/**
 * Interface for Receiver with required methods
 *
 * Neeeded to resolve import issues
 */
export type WorkflowReceiver = {
  verify: InstanceType<typeof Receiver>["verify"];
};

export const StepTypes = ["Initial", "Run", "SleepFor", "SleepUntil", "Call"] as const;
export type StepType = (typeof StepTypes)[number];

type ThirdPartyCallFields<TBody = unknown> = {
  /**
   * Third party call URL. Set when context.call is used.
   */
  callUrl: string;
  /**
   * Third party call method. Set when context.call is used.
   */
  callMethod: HTTPMethods;
  /**
   * Third party call body. Set when context.call is used.
   */
  callBody: TBody;
  /**
   * Third party call headers. Set when context.call is used.
   */
  callHeaders: Record<string, string>;
};

export type Step<TResult = unknown, TBody = unknown> = {
  /**
   * index of the step
   */
  stepId: number;
  /**
   * name of the step
   */
  stepName: string;
  /**
   * type of the step (Initial/Run/SleepFor/SleepUntil/Call)
   */
  stepType: StepType;
  /**
   * step result. Set if context.run or context.call are used.
   */
  out?: TResult;
  /**
   * sleep duration in seconds. Set when context.sleep is used.
   */
  sleepFor?: number;
  /**
   * unix timestamp (in seconds) to wait until. Set when context.sleepUntil is used.
   */
  sleepUntil?: number;
  /**
   * number of steps running concurrently if the step is in a parallel run.
   * Set to 1 if step is not parallel.
   */
  concurrent: number;
  /**
   * target step of a plan step. In other words, the step to assign the
   * result of a plan step.
   *
   * undefined if the step is not a plan step (of a parallel run). Otherwise,
   * set to the target step.
   */
  targetStep?: number;
} & (ThirdPartyCallFields<TBody> | { [P in keyof ThirdPartyCallFields]?: never }) & {
    nextStepOptions?: StepOptions;
  };

export type StepOptions = { retry?: number; stepName?: string };

export type RawStep = {
  messageId: string;
  body: string; // body is a base64 encoded step or payload
  callType: "step" | "toCallback" | "fromCallback";
};

export type SyncStepFunction<TResult> = () => TResult;
export type AsyncStepFunction<TResult> = () => Promise<TResult>;
export type StepFunction<TResult> = AsyncStepFunction<TResult> | SyncStepFunction<TResult>;

export type ParallelCallState = "first" | "partial" | "discard" | "last";

export type RouteFunction<TInitialPayload> = (
  context: WorkflowContext<TInitialPayload>
) => Promise<void>;

export type FinishCondition =
  | "success"
  | "duplicate-step"
  | "fromCallback"
  | "auth-fail"
  | "failure-callback";
export type WorkflowServeOptions<
  TResponse extends Response = Response,
  TInitialPayload = unknown,
> = {
  /**
   * QStash client
   */
  qstashClient?: WorkflowClient;
  /**
   * Function called to return a response after each step execution
   *
   * @param workflowRunId
   * @returns response
   */
  onStepFinish?: (workflowRunId: string, finishCondition: FinishCondition) => TResponse;
  /**
   * Function to parse the initial payload passed by the user
   */
  initialPayloadParser?: (initialPayload: string) => TInitialPayload;
  /**
   * Url of the endpoint where the workflow is set up.
   *
   * If not set, url will be inferred from the request.
   */
  url?: string;
  /**
   * Verbose mode
   *
   * Disabled if not set. If set to true, a logger is created automatically.
   *
   * Alternatively, a WorkflowLogger can be passed.
   */
  verbose?: WorkflowLogger | true;
  /**
   * Receiver to verify *all* requests by checking if they come from QStash
   *
   * By default, a receiver is created from the env variables
   * QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY if they are set.
   */
  receiver?: WorkflowReceiver;
  /**
   * Url to call if QStash retries are exhausted while executing the workflow
   */
  failureUrl?: string;
  /**
   * Failure function called when QStash retries are exhausted while executing
   * the workflow. Will overwrite `failureUrl` parameter with the workflow
   * endpoint if passed.
   *
   * @param context workflow context at the moment of error
   * @param failStatus error status
   * @param failResponse error message
   * @returns void
   */
  failureFunction?: (
    context: Omit<WorkflowContext, "run" | "sleepUntil" | "sleep" | "call">,
    failStatus: number,
    failResponse: string,
    failHeader: Record<string, string[]>
  ) => Promise<void> | void;
  /**
   * Base Url of the workflow endpoint
   *
   * Can be used to set if there is a local tunnel or a proxy between
   * QStash and the workflow endpoint.
   *
   * Will be set to the env variable UPSTASH_WORKFLOW_URL if not passed.
   * If the env variable is not set, the url will be infered as usual from
   * the `request.url` or the `url` parameter in `serve` options.
   *
   * @default undefined
   */
  baseUrl?: string;
  /**
   * Optionally, one can pass an env object mapping environment
   * variables to their keys.
   *
   * Useful in cases like cloudflare with hono.
   */
  env?: Record<string, string | undefined>;
};

/**
 * Payload passed as body in failureFunction
 */
export type FailureFunctionPayload = {
  /**
   * error name
   */
  error: string;
  /**
   * error message
   */
  message: string;
};

/**
 * Makes all fields except the ones selected required
 */
export type RequiredExceptFields<T, K extends keyof T> = Omit<Required<T>, K> & Partial<Pick<T, K>>;
