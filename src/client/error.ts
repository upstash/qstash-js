import type { ChatRateLimit, RateLimit } from "./types";

/**
 * Result of 500 Internal Server Error
 */
export class QstashError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "QstashError";
    this.cause = cause;
  }
}

export class QstashRatelimitError extends QstashError {
  constructor(args: RateLimit) {
    super(`You have been ratelimited. ${JSON.stringify(args)} `, args);
  }
}

export class QstashChatRatelimitError extends QstashError {
  constructor(args: ChatRateLimit) {
    super("You have been ratelimited.", args);
  }
}
