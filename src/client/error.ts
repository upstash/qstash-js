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
    super(`Exceeded burst rate limit. ${JSON.stringify(args)} `);
  }
}

export class QstashChatRatelimitError extends QstashError {
  constructor(args: ChatRateLimit) {
    super(`Exceeded chat rate limit. ${JSON.stringify(args)} `);
  }
}

export class QstashDailyRatelimitError extends QstashError {
  constructor(args: RateLimit) {
    super(`Exceeded daily rate limit. ${JSON.stringify(args)} `);
  }
}
