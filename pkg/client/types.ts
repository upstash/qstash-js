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
  messageID: string;
  taskID?: string;
  nextScheduledAt?: number;
  error?: string;
};

export type WithCursor<T> = T & { cursor?: number };

export type Task = {
  taskID: string;
  state: State;
  maxRetry: number;
  retried: number;
  completedAt?: number;
  url: string;
};
