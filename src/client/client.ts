import { DLQ } from "./dlq";
import { HttpClient, Requester, RetryConfig } from "./http";
import { Messages } from "./messages";
import { Schedules } from "./schedules";
import { Topics } from "./topics";
import { Event, State } from "./types";
import { prefixHeaders } from "./utils";
type ClientConfig = {
  /**
   * Url of the qstash api server.
   *
   * This is only used for testing.
   *
   * @default "https://qstash.upstash.io"
   */
  baseUrl?: string;

  /**
   * The authorization token from the upstash console.
   */
  token: string;

  /**
   * Configure how the client should retry requests.
   */
  retry?: RetryConfig;
};

export type PublishRequest<TBody = BodyInit> = {
  /**
   * The message to send.
   *
   * This can be anything, but please set the `Content-Type` header accordingly.
   *
   * You can leave this empty if you want to send a message with no body.
   */
  body?: TBody;

  /**
   * Optionally send along headers with the message.
   * These headers will be sent to your destination.
   *
   * We highly recommend sending a `Content-Type` header along, as this will help your destination
   * server to understand the content of the message.
   */
  headers?: HeadersInit;

  /**
   * Optionally delay the delivery of this message.
   *
   * In seconds.
   *
   * @default undefined
   */
  delay?: number;

  /**
   * Optionally set the absolute delay of this message.
   * This will override the delay option.
   * The message will not delivered until the specified time.
   *
   * Unix timestamp in seconds.
   *
   * @default undefined
   */
  notBefore?: number;

  /**
   * Provide a unique id for deduplication. This id will be used to detect duplicate messages.
   * If a duplicate message is detected, the request will be accepted but not enqueued.
   *
   * We store deduplication ids for 90 days. Afterwards it is possible that the message with the
   * same deduplication id is delivered again.
   *
   * When scheduling a message, the deduplication happens before the schedule is created.
   *
   * @default undefined
   */
  deduplicationId?: string;

  /**
   * If true, the message content will get hashed and used as deduplication id.
   * If a duplicate message is detected, the request will be accepted but not enqueued.
   *
   * The content based hash includes the following values:
   *    - All headers, except Upstash-Authorization, this includes all headers you are sending.
   *    - The entire raw request body The destination from the url path
   *
   * We store deduplication ids for 90 days. Afterwards it is possible that the message with the
   * same deduplication id is delivered again.
   *
   * When scheduling a message, the deduplication happens before the schedule is created.
   *
   * @default false
   */
  contentBasedDeduplication?: boolean;

  /**
   * In case your destination server is unavaialble or returns a status code outside of the 200-299
   * range, we will retry the request after a certain amount of time.
   *
   * Configure how many times you would like the delivery to be retried up to the maxRetries limit 
   * defined in your plan. 
   *
   * @default 3
   */
  retries?: number;

  /**
   * Use a callback url to forward the response of your destination server to your callback url.
   *
   * The callback url must be publicly accessible
   *
   * @default undefined
   */
  callback?: string;

  /**
   * Use a failure callback url to handle messages that could not be delivered.
   *
   * The failure callback url must be publicly accessible
   *
   * @default undefined
   */
  failureCallback?: string;

  /**
   * The method to use when sending a request to your API
   *
   * @default `POST`
   */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
} & (
  | {
      /**
       * The url where the message should be sent to.
       */
      url: string;
      topic?: never;
    }
  | {
      url?: never;
      /**
       * The url where the message should be sent to.
       */
      topic: string;
    }
);

export type PublishJsonRequest = Omit<PublishRequest, "body"> & {
  /**
   * The message to send.
   * This can be anything as long as it can be serialized to JSON.
   */
  body: unknown;
};

export type EventsRequest = {
  cursor?: number;
  messageId?: string;
  state?: State;
  url?: string;
  topicName?: string;
  scheduleId?: string;
  queueName?: string;
  fromDate?: number; // unix timestamp (ms)
  toDate?: number; // unix timestamp (ms)
  count?: number;
};

export type GetEventsResponse = {
  cursor?: number;
  events: Event[];
};

export class Client {
  public http: Requester;

  public constructor(config: ClientConfig) {
    this.http = new HttpClient({
      retry: config.retry,
      baseUrl: config.baseUrl
        ? config.baseUrl.replace(/\/$/, "")
        : "https://qstash.upstash.io",
      authorization: `Bearer ${config.token}`,
    });
  }

  /**
   * Access the topic API.
   *
   * Create, read, update or delete topics.
   */
  public get topics(): Topics {
    return new Topics(this.http);
  }

  /**
   * Access the dlq API.
   *
   * List or remove messages from the DLQ.
   */
  public get dlq(): DLQ {
    return new DLQ(this.http);
  }

  /**
   * Access the message API.
   *
   * Read or cancel messages.
   */
  public get messages(): Messages {
    return new Messages(this.http);
  }

  /**
   * Access the schedule API.
   *
   * Create, read or delete schedules.
   */
  public get schedules(): Schedules {
    return new Schedules(this.http);
  }

  private processHeaders(req: PublishRequest) {
    const headers = prefixHeaders(new Headers(req.headers));

    headers.set("Upstash-Method", req.method ?? "POST");

    if (typeof req.delay !== "undefined") {
      headers.set("Upstash-Delay", `${req.delay.toFixed()}s`);
    }

    if (typeof req.notBefore !== "undefined") {
      headers.set("Upstash-Not-Before", req.notBefore.toFixed());
    }

    if (typeof req.deduplicationId !== "undefined") {
      headers.set("Upstash-Deduplication-Id", req.deduplicationId);
    }

    if (typeof req.contentBasedDeduplication !== "undefined") {
      headers.set("Upstash-Content-Based-Deduplication", "true");
    }

    if (typeof req.retries !== "undefined") {
      headers.set("Upstash-Retries", req.retries.toFixed());
    }

    if (typeof req.callback !== "undefined") {
      headers.set("Upstash-Callback", req.callback);
    }

    if (typeof req.failureCallback !== "undefined") {
      headers.set("Upstash-Failure-Callback", req.failureCallback);
    }

    return headers;
  }

  public async publish<TRequest extends PublishRequest>(
    req: TRequest
  ): Promise<PublishResponse<TRequest>> {
    const headers = this.processHeaders(req);
    const res = await this.http.request<PublishResponse<TRequest>>({
      path: ["v2", "publish", req.url ?? req.topic],
      body: req.body,
      headers,
      method: "POST",
    });
    return res;
  }

  /**
   * publishJSON is a utility wrapper around `publish` that automatically serializes the body
   * and sets the `Content-Type` header to `application/json`.
   */
  public async publishJSON<
    TBody = unknown,
    TRequest extends PublishRequest<TBody> = PublishRequest<TBody>
  >(req: TRequest): Promise<PublishResponse<TRequest>> {
    const headers = prefixHeaders(new Headers(req.headers));
    headers.set("Content-Type", "application/json");

    // @ts-ignore it's just internal
    const res = await this.publish<TRequest>({
      ...req,
      headers,
      body: JSON.stringify(req.body),
    } as PublishRequest);
    return res;
  }

  /**
   * Batch publish messages to QStash.
   */
  public async batch(
    req: PublishRequest[]
  ): Promise<PublishResponse<PublishRequest>[]> {
    const messages = [];
    for (const message of req) {
      const headers = this.processHeaders(message);
      const headerEntries = Object.fromEntries(headers.entries());

      messages.push({
        destination: message.url ?? message.topic,
        headers: headerEntries,
        body: message.body,
      });
    }

    const res = await this.http.request<PublishResponse<PublishRequest>[]>({
      path: ["v2", "batch"],
      body: JSON.stringify(messages),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return res;
  }

  /**
   * Batch publish messages to QStash, serializing each body to JSON.
   */
  public async batchJSON<
    TBody = unknown,
    TRequest extends PublishRequest<TBody> = PublishRequest<TBody>
  >(req: TRequest[]): Promise<PublishResponse<TRequest>[]> {
    for (const message of req) {
      if ("body" in message) {
        message.body = JSON.stringify(message.body) as unknown as TBody;
      }

      message.headers = new Headers(message.headers);
      message.headers.set("Content-Type", "application/json");
    }

    // Since we are serializing the bodies to JSON, and stringifying,
    //  we can safely cast the request to `PublishRequest`
    const res = await this.batch(req as PublishRequest[]);
    return res as PublishResponse<TRequest>[];
  }

  /**
   * Retrieve your logs.
   *
   * The logs endpoint is paginated and returns only 100 logs at a time.
   * If you want to receive more logs, you can use the cursor to paginate.
   *
   * The cursor is a unix timestamp with millisecond precision
   *
   * @example
   * ```ts
   * let cursor = Date.now()
   * const logs: Log[] = []
   * while (cursor > 0) {
   *   const res = await qstash.logs({ cursor })
   *   logs.push(...res.logs)
   *   cursor = res.cursor ?? 0
   * }
   * ```
   */
  public async events(req?: EventsRequest): Promise<GetEventsResponse> {
    const query: Record<string, string> = {};
    Object.keys(req ?? {}).forEach(key => {
      const value = (req as Record<string, any>)[key];
      if (typeof value === "number" && value < 0) {
        return;
      }
      if (typeof value !== "undefined") {
        query[key] = value.toString();
      }
    });

    const res = await this.http.request<GetEventsResponse>({
      path: ["v2", "events"],
      method: "GET",
      query,
    });
    return res;
  }
}
export type PublishToUrlResponse = {
  messageId: string;
  url: string;
  deduplicated?: boolean;
};

export type PublishToTopicResponse = PublishToUrlResponse[];

export type PublishResponse<R> = R extends { url: string }
  ? PublishToUrlResponse
  : PublishToTopicResponse;
