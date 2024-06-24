export type State = "CREATED" | "ACTIVE" | "DELIVERED" | "ERROR" | "RETRY" | "FAILED";

export type Event = {
  time: number;
  state: State;
  messageId: string;
  nextDeliveryTime?: number;
  error?: string;
  url: string;
  urlGroup?: string;
  endpointName?: string;
};

export type EventPayload = Omit<Event, "urlGroup"> & { topicName: string };

export type GetEventsPayload = {
  cursor?: number;
  events: EventPayload[];
};

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
