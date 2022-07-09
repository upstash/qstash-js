export type State =
  | "created"
  | "planned"
  | "active"
  | "delivered"
  | "error"
  | "failed"
  | "canceled";

export type Log = {
  time: number;
  state: State;
  messageId: string;
  taskId?: string;
  nextScheduledAt?: number;
  error?: string;
};

export type WithCursor<T> = T & { cursor?: number };

export type Task = {
  taskId: string;
  state: State;
  maxRetry: number;
  retried: number;
  completedAt?: number;
  url: string;
};
