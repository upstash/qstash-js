import type { ChatRateLimit, RateLimit } from "./types";

const RATELIMIT_STATUS = 429;

/**
 * Result of 500 Internal Server Error
 */
export class QstashError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "QstashError";
    this.status = status;
  }
}

export class QstashRatelimitError extends QstashError {
  public limit: string | null;
  public remaining: string | null;
  public reset: string | null;

  constructor(args: RateLimit) {
    super(`Exceeded burst rate limit. ${JSON.stringify(args)}`, RATELIMIT_STATUS);
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
    super(`Exceeded chat rate limit. ${JSON.stringify(args)}`, RATELIMIT_STATUS);
    this.name = "QstashChatRatelimitError";
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
    super(`Exceeded daily rate limit. ${JSON.stringify(args)}`, RATELIMIT_STATUS);
    this.name = "QstashDailyRatelimitError";
    this.limit = args.limit;
    this.remaining = args.remaining;
    this.reset = args.reset;
  }
}
