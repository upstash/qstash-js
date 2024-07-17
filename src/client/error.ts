import type { ChatRateLimit, RateLimit } from "./types";
import type { Step } from "./workflow/types";

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
  constructor(args: RateLimit) {
    super(`You have been ratelimited. ${JSON.stringify(args)} `);
    this.name = "QstashRatelimitError";
  }
}

export class QstashChatRatelimitError extends QstashError {
  constructor(args: ChatRateLimit) {
    super(`You have been ratelimited. ${JSON.stringify(args)} `);
    this.name = "QstashChatRatelimitError";
  }
}

/**
 * Error raised during Workflow execution
 */
export class QstashWorkflowError extends QstashError {
  constructor(message: string) {
    super(message);
    this.name = "QstashWorkflowError";
  }
}

/**
 * Raised when the workflow executes a function and aborts
 */
export class QstashWorkflowAbort extends Error {
  public stepInfo?: Step;
  public stepName: string;

  constructor(stepName: string, stepInfo?: Step) {
    super("Aborting workflow after executing a step.");
    this.name = "QstashWorkflowAbort";
    this.stepName = stepName;
    this.stepInfo = stepInfo;
  }
}
