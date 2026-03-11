import type { State } from "./types";

// ── Filter Utility Types ──────────────────────────────────────

type NeverAll<T> = { [K in keyof T]?: never };

type RequireAtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> }[keyof T];

/**
 * Three-way exclusive union: at-least-one-filter OR `{ all: true }` OR IDs.
 * Exactly one branch can be satisfied at a time.
 *
 * The filter and all branches intentionally omit `NeverAll<Ids>` so that
 * TypeScript's `"key" in request` narrowing correctly isolates the IDs branch.
 * Excess-property checks on object literals still prevent mixing ID keys with filters.
 */
type FilterAllOrIds<F extends Record<string, unknown>, Ids extends Record<string, unknown>> =
  | (F & RequireAtLeastOne<F> & { all?: never })
  | ({ all: true } & NeverAll<F>)
  | (Ids & NeverAll<F> & { all?: never });

// ── Filter Field Groups ───────────────────────────────────────

/** Shared filter fields accepted by every qstash & workflow endpoint. */
export type UniversalFilterFields = {
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
  messageIds?: string[];
};

// ── QStash Composed Endpoint Filter Types ─────────────────────

/**
 * Doesn't allow a single messageId because this is a bulk action
 */
export type MessageCancelFilters = FilterAllOrIds<
  UniversalFilterFields & Omit<QStashIdentityFields, "messageId">,
  { messageIds: string[] }
>;

export type DLQBulkActionFilters = FilterAllOrIds<
  UniversalFilterFields & QStashIdentityFields & DLQResponseFields,
  { dlqIds: string | string[] }
>;

export type DLQListFilters = UniversalFilterFields & QStashIdentityFields & DLQResponseFields;

export type LogsListFilters = UniversalFilterFields &
  QStashIdentityFields &
  LogsFilterFields & {
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
