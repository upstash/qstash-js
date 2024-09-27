import type { ChatRateLimit, RateLimit } from "./types";
import type { FailureFunctionPayload, Step } from "./workflow/types";

/**
 * Result of 500 Internal Server Error
 */
export class QstashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QstashError";
  }
}

export class QstashRatelimitError extends QstashError {
  public limit: string | null;
  public remaining: string | null;
  public reset: string | null;

  constructor(args: RateLimit) {
    super(`Exceeded burst rate limit. ${JSON.stringify(args)} `);
    this.name = "QstashRatelimitError";
    this.limit = args.limit;
    this.remaining = args.remaining;
    this.reset = args.reset;
  }
}

export class QstashChatRatelimitError extends QstashError {
  public limitRequests: string | null;
  public limitTokens: string | null;
  public remainingRequests: string | null;
  public remainingTokens: string | null;
  public resetRequests: string | null;
  public resetTokens: string | null;

  constructor(args: ChatRateLimit) {
    super(`Exceeded chat rate limit. ${JSON.stringify(args)} `);
    this.limitRequests = args["limit-requests"];
    this.limitTokens = args["limit-tokens"];
    this.remainingRequests = args["remaining-requests"];
    this.remainingTokens = args["remaining-tokens"];
    this.resetRequests = args["reset-requests"];
    this.resetTokens = args["reset-tokens"];
  }
}

export class QstashDailyRatelimitError extends QstashError {
  public limit: string | null;
  public remaining: string | null;
  public reset: string | null;

  constructor(args: RateLimit) {
    super(`Exceeded daily rate limit. ${JSON.stringify(args)} `);
    this.limit = args.limit;
    this.remaining = args.remaining;
    this.reset = args.reset;
    this.name = "QstashChatRatelimitError";
  }
}

/**
 * Error raised during Workflow execution
 */
export class QStashWorkflowError extends QstashError {
  constructor(message: string) {
    super(message);
    this.name = "QStashWorkflowError";
  }
}

/**
 * Raised when the workflow executes a function and aborts
 */
export class QStashWorkflowAbort extends Error {
  public stepInfo?: Step;
  public stepName: string;

  constructor(stepName: string, stepInfo?: Step) {
    super(
      "This is an Upstash Workflow error thrown after a step executes. It is expected to be raised." +
        " Make sure that you await for each step. Also, if you are using try/catch blocks, you should not wrap context.run/sleep/sleepUntil/call methods with try/catch." +
        ` Aborting workflow after executing step '${stepName}'.`
    );
    this.name = "QStashWorkflowAbort";
    this.stepName = stepName;
    this.stepInfo = stepInfo;
  }
}

/**
 * Formats an unknown error to match the FailureFunctionPayload format
 *
 * @param error
 * @returns
 */
export const formatWorkflowError = (error: unknown): FailureFunctionPayload => {
  return error instanceof Error
    ? {
        error: error.name,
        message: error.message,
      }
    : {
        error: "Error",
        message: "An error occured while executing workflow.",
      };
};
