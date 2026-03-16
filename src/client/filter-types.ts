import type { State } from "./types";

// ── Filter Utility Types ──────────────────────────────────────

type RequireAtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> }[keyof T];

type NeverKeys<T> = { [K in keyof T]?: never };

/** Two-branch exclusive union: A or B, never both. */
type Exclusive<A, B> = (A & NeverKeys<B>) | (B & NeverKeys<A>);

/** Three-branch exclusive union: exactly one of A, B, or C. */
type Exclusive3<A, B, C> =
  | (A & NeverKeys<B> & NeverKeys<C>)
  | (B & NeverKeys<A> & NeverKeys<C>)
  | (C & NeverKeys<A> & NeverKeys<B>);

// ── Filter Field Groups ───────────────────────────────────────

/** Shared filter fields accepted by every qstash & workflow endpoint. */
type UniversalFilterFields = {
  fromDate?: Date | number;
  toDate?: Date | number;
  callerIp?: string;
  label?: string;
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

type MessageCancelFilterFields = UniversalFilterFields & Omit<QStashIdentityFields, "messageId">;

// ── QStash Composed Endpoint Filter Types ─────────────────────

/**
 * Doesn't allow a single messageId because this is a bulk action.
 * Cancel does not support cursor.
 */
export type MessageCancelFilters = Exclusive3<
  { messageIds: string[] },
  { filter: RequireAtLeastOne<MessageCancelFilterFields> },
  { all: true }
>;

/**
 * DLQ bulk actions support three modes:
 * - By dlqIds (no cursor)
 * - By filter fields (with optional cursor)
 * - All (with optional cursor)
 */
export type DLQBulkActionFilters = Exclusive3<
  { dlqIds: string | string[] },
  { filter: RequireAtLeastOne<DLQFilterFields>; cursor?: string },
  { all: true; cursor?: string }
>;

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
