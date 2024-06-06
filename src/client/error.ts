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
  constructor(args: unknown) {
    super(`You have been ratelimited. ${JSON.stringify(args)} `);
  }
}

export class QstashChatRatelimitError extends QstashError {
  constructor(args: unknown) {
    super(`You have been ratelimited. ${JSON.stringify(args)} `);
  }
}
