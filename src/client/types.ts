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
       * The time interval during which the specified `rate` of requests can be activated
       * using the same flow control key.
       *
       * Defaults to one second.
       *
       * If specified as a number, it is interpreted as seconds. Alternatively a duration string
       * can be passed like "10s", "5d".
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
       * The time interval during which the specified `rate` of requests can be activated
       * using the same flow control key.
       *
       * Defaults to one second.
       *
       * If specified as a number, it is interpreted as seconds. Alternatively a duration string
       * can be passed like "10s", "5d".
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
       * The time interval during which the specified `rate` of requests can be activated
       * using the same flow control key.
       *
       * Defaults to one second.
       *
       * If specified as a number, it is interpreted as seconds. Alternatively a duration string
       * can be passed like "10s", "5d".
       */
      period?: Duration | number;
    }
);
