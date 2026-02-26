import type { Duration } from "./duration";

export type State =
  | "CREATED"
  | "ACTIVE"
  | "DELIVERED"
  | "ERROR"
  | "RETRY"
  | "FAILED"
  | "CANCELED"
  | "IN_PROGRESS";

export type HTTPMethods = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type Log = {
  time: number;
  state: State;
  messageId: string;
  nextDeliveryTime?: number;
  error?: string;
  url: string;
  urlGroup?: string;
  topicName?: string;
  endpointName?: string;
  header?: Record<string, string>;
  body?: string; // base64 encoded
  label?: string;
};

/**
 * Deprecated. Use the `Log` type instead.
 *
 * @deprecated
 */
export type Event = Log;

export type LogPayload = Omit<Log, "urlGroup"> & { topicName: string };

/**
 * Deprecated. Use the `EventPayload` type instead.
 *
 * @deprecated
 */
export type EventPayload = LogPayload;

export type GetLogsPayload = {
  cursor?: string;
  events: LogPayload[];
};

/**
 * Deprecated. use the `GetLogsPayload` type instead.
 *
 * @deprecated
 */
export type GetEventsPayload = GetLogsPayload;

export type WithCursor<T> = T & { cursor?: number };

export type BodyInit = Blob | FormData | URLSearchParams | ReadableStream<Uint8Array> | string;
export type HeadersInit =
  | Headers
  | Record<string, string>
  | [string, string][]
  | IterableIterator<[string, string]>;

export type RequestOptions = RequestInit & { backend?: string };

export type ChatRateLimit = {
  "limit-requests": string | null;
  "limit-tokens": string | null;
  "remaining-requests": string | null;
  "remaining-tokens": string | null;
  "reset-requests": string | null;
  "reset-tokens": string | null;
};

export type RateLimit = {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
};

export type FlowControl = {
  /**
   * flow control key
   */
  key: string;
} & (
  | {
      /**
       * number of requests which can be active with the same flow control key
       */
      parallelism: number;
      /**
       * number of requests to activate per second with the same flow control key
       *
       * @deprecated use rate instead
       */
      ratePerSecond?: number;
      /**
       * number of requests to activate within the period with the same flow control key.
       *
       * Default period is a second.
       */
      rate?: number;
      /**
       * The time interval for the `rate` limit.
       *
       * For example, if `rate` is 10 and `period` is "1s" (or 1), then 10 requests can be activated per second.
       * If `rate` is 5 and `period` is "1m" (or 60), then 5 requests can be activated per minute.
       *
       * Defaults to "1s" (one second) if not specified.
       *
       * Can be specified as a number (in seconds) or a duration string (e.g., "10s", "5m", "1h", "2d").
       */
      period?: Duration | number;
    }
  | {
      /**
       * number of requests which can be active with the same flow control key
       */
      parallelism?: number;
      /**
       * number of requests to activate per second with the same flow control key
       *
       * @deprecated use rate instead
       */
      ratePerSecond: number;
      /**
       * number of requests to activate within the period with the same flow control key.
       * Default period is a second.
       */
      rate?: number;
      /**
       * The time interval for the `rate` limit.
       *
       * For example, if `rate` is 10 and `period` is "1s" (or 1), then 10 requests can be activated per second.
       * If `rate` is 5 and `period` is "1m" (or 60), then 5 requests can be activated per minute.
       *
       * Defaults to "1s" (one second) if not specified.
       *
       * Can be specified as a number (in seconds) or a duration string (e.g., "10s", "5m", "1h", "2d").
       */
      period?: Duration | number;
    }
  | {
      /**
       * number of requests which can be active with the same flow control key
       */
      parallelism?: number;
      /**
       * number of requests to activate per second with the same flow control key
       *
       * @deprecated use rate instead
       */
      ratePerSecond?: number;
      /**
       * number of requests to activate within the period with the same flow control key.
       * Default period is a second.
       */
      rate: number;
      /**
       * The time interval for the `rate` limit.
       *
       * For example, if `rate` is 10 and `period` is "1s" (or 1), then 10 requests can be activated per second.
       * If `rate` is 5 and `period` is "1m" (or 60), then 5 requests can be activated per minute.
       *
       * Defaults to "1s" (one second) if not specified.
       *
       * Can be specified as a number (in seconds) or a duration string (e.g., "10s", "5m", "1h", "2d").
       */
      period?: Duration | number;
    }
);

// These are the filters that can be used by
// Logs, DLQ and bulk cancel actions.
export type QStashCommonFilters = {
  scheduleId?: string;
  messageId?: string;
  url?: string;
  urlGroup?: string;
  queueName?: string;
  /**
   * Filter by creation date (from). Accepts a Date object or a Unix timestamp in milliseconds.
   */
  fromDate?: Date | number;
  /**
   * Filter by creation date (to). Accepts a Date object or a Unix timestamp in milliseconds.
   */
  toDate?: Date | number;
  label?: string;
  flowControlKey?: string;
  /**
   * Set to `true` to apply the action to all items, ignoring all other filters.
   *
   * @example
   * ```ts
   * await client.messages.cancel({ all: true });
   * await client.dlq.delete({ all: true });
   * await client.dlq.retry({ all: true });
   * ```
   */
  all?: boolean;
};
