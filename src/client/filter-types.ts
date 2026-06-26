import type { State } from "./types";

// ── Filter Utility Types ──────────────────────────────────────

type RequireAtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> }[keyof T];

type NeverKeys<T> = { [K in keyof T]?: never };

/** Two-branch exclusive union: A or B, never both. */
type Exclusive<A, B> = (A & NeverKeys<B>) | (B & NeverKeys<A>);

// ── Filter Field Groups ───────────────────────────────────────

/** Shared filter fields accepted by every qstash & workflow endpoint. */
type UniversalFilterFields = {
  fromDate?: Date | number;
  toDate?: Date | number;
  callerIp?: string;
  /**
   * Filter by label.
   *
   * Pass an array to match runs that have any of the given labels (OR semantics).
   * For example, with runs labelled `[label_1, label_2]` and `[label_2, label_3]`,
   * filtering by `[label_1, label_2]` returns both.
   */
  label?: string | string[];
  flowControlKey?: string;
};

/** QStash-specific identity filters (DLQ + message endpoints). */
type QStashIdentityFields = {
  messageId?: string;
  url?: string;
  urlGroup?: string;
  scheduleId?: string;
  queueName?: string;
};

/** DLQ-specific response filter. */
type DLQResponseFields = {
  responseStatus?: number;
};

/** Logs-specific filter fields exclusive to log endpoints. */
type LogsFilterFields = {
  state?: State;
};

// ── Composed Filter Field Types ───────────────────────────────

type DLQFilterFields = UniversalFilterFields &
  QStashIdentityFields &
  DLQResponseFields & {
    /**
     * @deprecated `api` filter has been removed from the API and will be ignored
     */
    api?: string;
  };

/**
 * Filter fields for the bulk message cancel endpoint.
 *
 * Unlike the DLQ and logs endpoints, bulk cancel supports multi-value filtering:
 * a message matches if its value equals any of the given values (OR logic), and
 * separate filters are combined with AND logic. Pass an array to match any value.
 */
type MessageCancelFilterFields = Omit<
  UniversalFilterFields & Omit<QStashIdentityFields, "messageId">,
  "callerIp" | "flowControlKey" | "url" | "urlGroup" | "scheduleId" | "queueName"
> & {
  /** Filter by the IP address of the publisher. Supports multiple values. */
  callerIp?: string | string[];
  /** Filter by Flow Control Key. Supports multiple values. */
  flowControlKey?: string | string[];
  /** Filter by destination URL. Supports multiple values. */
  url?: string | string[];
  /** Filter by URL Group name. Supports multiple values. */
  urlGroup?: string | string[];
  /** Filter by Schedule ID. Supports multiple values. */
  scheduleId?: string | string[];
  /** Filter by Queue name. Supports multiple values. */
  queueName?: string | string[];
  /** Filter by the host of the destination URL. Supports multiple values. */
  host?: string | string[];
  /** Filter by the path of the destination URL. Supports multiple values. */
  path?: string | string[];
};

// ── QStash Composed Endpoint Filter Types ─────────────────────

/**
 * Doesn't allow a single messageId because this is a bulk action.
 * Cancel does not support cursor.
 */
export type MessageCancelFilters =
  | { messageIds: string[]; filter?: never; all?: never; count?: never }
  | ({
      filter: RequireAtLeastOne<MessageCancelFilterFields>;
      messageIds?: never;
      all?: never;
    } & MessageCancelCount)
  | ({ all: true; messageIds?: never; filter?: never } & MessageCancelCount);

type MessageCancelCount = {
  /**
   * Maximum number of messages to cancel per call.
   *
   * @default 100
   */
  count?: number;
};

/**
 * DLQ bulk actions support three modes:
 * - By dlqIds (no cursor)
 * - By filter fields (with optional cursor)
 * - All (with optional cursor)
 */
export type DLQBulkActionFilters =
  | { dlqIds: string | string[]; filter?: never; all?: never; count?: never; cursor?: never }
  | ({
      filter: RequireAtLeastOne<DLQFilterFields>;
      dlqIds?: never;
      all?: never;
    } & DLQBulkActionCount)
  | ({
      all: true;
      dlqIds?: never;
      filter?: never;
    } & DLQBulkActionCount);

type DLQBulkActionCount = {
  cursor?: string;
  /**
   * Maximum number of messages to process per call.
   *
   * @default 100
   */
  count?: number;
};

export type DLQListRequest = Exclusive<
  { dlqIds: string | string[] },
  { filter?: DLQFilterFields; cursor?: string }
>;

export type LogsListRequest = Exclusive<
  { messageIds: string[] },
  {
    filter?: LogsListFilters;
    /**
     * Passing `number` may silently break due to JavaScript integer precision
     * limits — cursor values can exceed `Number.MAX_SAFE_INTEGER`. Use `string` instead.
     */
    cursor?: string | number;
  }
>;

export type LogsListFilters = UniversalFilterFields &
  Omit<QStashIdentityFields, "messageId"> &
  LogsFilterFields & {
    /**
     * @deprecated `api` filter has been removed from the API and will be ignored
     */
    api?: string;
    /**
     * @deprecated use `messageIds` in the root instead of `messageId` in the `filter` object
     *
     * Example:
     * ```ts
     * await client.logs({ messageIds: ["id1", "id2"] })
     * ```
     */
    messageId?: string;
    /**
     * @deprecated use `urlGroup` instead
     */
    topicName?: string;
    /**
     * @deprecated use `count` option in the root instead of the `filter` object
     *
     * Example:
     * ```ts
     * await client.logs({ count: 50 })
     * ```
     */
    count?: number;
  };
