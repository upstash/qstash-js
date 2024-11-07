import { DLQ } from "./dlq";
import type { Duration } from "./duration";
import { HttpClient, type Requester, type RetryConfig } from "./http";
import { Chat } from "./llm/chat";
import { Messages } from "./messages";
import { Queue } from "./queue";
import { Schedules } from "./schedules";
import type { BodyInit, Event, GetEventsPayload, HeadersInit, HTTPMethods, State } from "./types";
import { UrlGroups } from "./url-groups";
import { getRequestPath, prefixHeaders, processHeaders } from "./utils";
import { Workflow } from "./workflow";
import type { PublishEmailApi, PublishLLMApi } from "./api/types";
import { processApi } from "./api/utils";

type ClientConfig = {
  /**
   * Url of the QStash api server.
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

export type PublishBatchRequest<TBody = BodyInit> = PublishRequest<TBody> & {
  queueName?: string;
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
  delay?: Duration | number;

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
  method?: HTTPMethods;

  /**
   * The HTTP timeout value to use while calling the destination URL.
   * When a timeout is specified, it will be used instead of the maximum timeout
   * value permitted by the QStash plan. It is useful in scenarios, where a message
   * should be delivered with a shorter timeout.
   *
   * In seconds.
   *
   * @default undefined
   */
  timeout?: Duration | number;
} & (
  | {
      /**
       * The url where the message should be sent to.
       */
      url: string;
      urlGroup?: never;
      api?: never;
      topic?: never;
      /**
       * Use a callback url to forward the response of your destination server to your callback url.
       *
       * The callback url must be publicly accessible
       *
       * @default undefined
       */
      callback?: string;
    }
  | {
      url?: never;
      /**
       * The url group the message should be sent to.
       */
      urlGroup: string;
      api?: never;
      topic?: never;
      /**
       * Use a callback url to forward the response of your destination server to your callback url.
       *
       * The callback url must be publicly accessible
       *
       * @default undefined
       */
      callback?: string;
    }
  | {
      url?: string;
      urlGroup?: never;
      /**
       * The api endpoint the request should be sent to.
       */
      api: PublishLLMApi;
      topic?: never;
      /**
       * Use a callback url to forward the response of your destination server to your callback url.
       *
       * The callback url must be publicly accessible
       *
       * @default undefined
       */
      callback: string;
    }
  | {
      url?: never;
      urlGroup?: never;
      /**
       * The api endpoint the request should be sent to.
       */
      api: PublishEmailApi;
      topic?: never;
      callback?: string;
    }
  | {
      url?: never;
      urlGroup?: never;
      api?: never;
      /**
       * Deprecated. The topic the message should be sent to. Same as urlGroup
       *
       * @deprecated
       */
      topic?: string;
      /**
       * Use a callback url to forward the response of your destination server to your callback url.
       *
       * The callback url must be publicly accessible
       *
       * @default undefined
       */
      callback?: string;
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
  cursor?: string | number;
  filter?: EventsRequestFilter;
};

type EventsRequestFilter = {
  messageId?: string;
  state?: State;
  url?: string;
  urlGroup?: string;
  topicName?: string;
  api?: string;
  scheduleId?: string;
  queueName?: string;
  fromDate?: number; // unix timestamp (ms)
  toDate?: number; // unix timestamp (ms)
  count?: number;
};

export type GetEventsResponse = {
  cursor?: string;
  events: Event[];
};

export type QueueRequest = {
  queueName?: string;
};

export class Client {
  public http: Requester;
  private token: string;

  public constructor(config: ClientConfig) {
    this.http = new HttpClient({
      retry: config.retry,
      baseUrl: config.baseUrl ? config.baseUrl.replace(/\/$/, "") : "https://qstash.upstash.io",
      authorization: `Bearer ${config.token}`,
    });
    this.token = config.token;
  }

  /**
   * Access the urlGroup API.
   *
   * Create, read, update or delete urlGroups.
   */
  public get urlGroups(): UrlGroups {
    return new UrlGroups(this.http);
  }

  /**
   * Deprecated. Use urlGroups instead.
   *
   * Access the topic API.
   *
   * Create, read, update or delete topics.
   */
  public get topics(): UrlGroups {
    return this.urlGroups;
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

  /**
   * Access the workflow API.
   *
   * cancel workflows.
   *
   * @deprecated as of version 2.7.17. Will be removed in qstash-js 3.0.0.
   * Please use @upstash/workflow instead https://github.com/upstash/workflow-js
   * Migration Guide: https://upstash.com/docs/workflow/migration
   */
  public get workflow(): Workflow {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return new Workflow(this.http);
  }

  /**
   * Access the queue API.
   *
   * Create, read, update or delete queues.
   */
  public queue(request?: QueueRequest): Queue {
    return new Queue(this.http, request?.queueName);
  }

  /**
   * Access the Chat API
   *
   * Call the create or prompt methods
   */
  public chat(): Chat {
    return new Chat(this.http, this.token);
  }

  public async publish<TRequest extends PublishRequest>(
    request: TRequest
  ): Promise<PublishResponse<TRequest>> {
    const headers = processHeaders(request);
    const response = await this.http.request<PublishResponse<TRequest>>({
      path: ["v2", "publish", getRequestPath(request)],
      body: request.body,
      headers,
      method: "POST",
    });
    return response;
  }

  /**
   * publishJSON is a utility wrapper around `publish` that automatically serializes the body
   * and sets the `Content-Type` header to `application/json`.
   */
  public async publishJSON<
    TBody = unknown,
    TRequest extends PublishRequest<TBody> = PublishRequest<TBody>,
  >(request: TRequest): Promise<PublishResponse<TRequest>> {
    //@ts-expect-error caused by undici and bunjs type overlap
    const headers = prefixHeaders(new Headers(request.headers));
    headers.set("Content-Type", "application/json");
    request.headers = headers;

    //@ts-expect-error hacky way to get bearer token
    const upstashToken = String(this.http.authorization).split("Bearer ")[1];
    const nonApiRequest = processApi(request, upstashToken);

    // @ts-expect-error it's just internal
    const response = await this.publish<TRequest>({
      ...nonApiRequest,
      body: JSON.stringify(nonApiRequest.body),
    } as PublishRequest);

    return response;
  }

  /**
   * Batch publish messages to QStash.
   */
  public async batch(request: PublishBatchRequest[]): Promise<PublishResponse<PublishRequest>[]> {
    const messages = [];
    for (const message of request) {
      const headers = processHeaders(message);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore Type mismatch TODO: should be checked later
      const headerEntries = Object.fromEntries(headers.entries());

      messages.push({
        destination: getRequestPath(message),
        headers: headerEntries,
        body: message.body,
        ...(message.queueName && { queue: message.queueName }),
      });
    }

    const response = await this.http.request<PublishResponse<PublishRequest>[]>({
      path: ["v2", "batch"],
      body: JSON.stringify(messages),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const arrayResposne = Array.isArray(response) ? response : [response];

    return arrayResposne;
  }

  /**
   * Batch publish messages to QStash, serializing each body to JSON.
   */
  public async batchJSON<
    TBody = unknown,
    TRequest extends PublishBatchRequest<TBody> = PublishBatchRequest<TBody>,
  >(request: TRequest[]): Promise<PublishResponse<TRequest>[]> {
    const batchPayload = request.map((message) => {
      if ("body" in message) {
        message.body = JSON.stringify(message.body) as unknown as TBody;
      }
      //@ts-expect-error caused by undici and bunjs type overlap
      message.headers = new Headers(message.headers);

      //@ts-expect-error hacky way to get bearer token
      const upstashToken = String(this.http.authorization).split("Bearer ")[1];
      const nonApiMessage = processApi(message, upstashToken);

      (nonApiMessage.headers as Headers).set("Content-Type", "application/json");

      return nonApiMessage;
    });

    // Since we are serializing the bodies to JSON, and stringifying,
    //  we can safely cast the request to `PublishRequest`
    const response = await this.batch(batchPayload as PublishRequest[]);
    return response as PublishResponse<TRequest>[];
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
  public async events(request?: EventsRequest): Promise<GetEventsResponse> {
    const query: Record<string, string> = {};

    if (typeof request?.cursor === "number" && request.cursor > 0) {
      query.cursor = request.cursor.toString();
    } else if (typeof request?.cursor === "string" && request.cursor !== "") {
      query.cursor = request.cursor;
    }

    for (const [key, value] of Object.entries(request?.filter ?? {})) {
      if (typeof value === "number" && value < 0) {
        continue;
      }
      if (key === "urlGroup") {
        query.topicName = value.toString();
        // eslint-disable-next-line unicorn/no-typeof-undefined
      } else if (typeof value !== "undefined") {
        query[key] = value.toString();
      }
    }

    const responsePayload = await this.http.request<GetEventsPayload>({
      path: ["v2", "events"],
      method: "GET",
      query,
    });
    return {
      cursor: responsePayload.cursor,
      events: responsePayload.events.map((event) => {
        return {
          ...event,
          urlGroup: event.topicName,
        };
      }),
    };
  }
}

export type PublishToApiResponse = {
  messageId: string;
};

export type PublishToUrlResponse = PublishToApiResponse & {
  url: string;
  deduplicated?: boolean;
};

export type PublishToUrlGroupsResponse = PublishToUrlResponse[];

export type PublishResponse<TRequest> = TRequest extends { url: string }
  ? PublishToUrlResponse
  : TRequest extends { urlGroup: string }
    ? PublishToUrlGroupsResponse
    : PublishToApiResponse;
