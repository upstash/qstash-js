import type { ChatRateLimit, RateLimit } from "./types";

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

export class QstashWorkflowError extends QstashError {
  constructor(message: string) {
    super(message);
    this.name = "QstashWorkflowError";
  }
}
