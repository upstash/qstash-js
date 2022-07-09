import { HttpClient, Requester } from "./http.ts";
import { Topics } from "./topics.ts";
import { Messages } from "./messages.ts";
import { Schedules } from "./schedules.ts";
import { Endpoints } from "./endpoints.ts";
import type { Log } from "./types.ts";

import type { HeadersInit, BodyInit } from "https://raw.githubusercontent.com/microsoft/TypeScript/main/lib/lib.dom.d.ts"


export type ClientConfig = {
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
};

type Destination = {
  /**
   * The url of a publicly accessible server where you want to send this message to.
   * The url must have a valid scheme (http or https).
   */
  url: string;
  topic?: never;
} | {
  url?: never;
  /**
   * Either the name or id of a topic to send this message to.
   */
  topic: string;
};

export type PublishRequest =
  & Destination
  & {
    /**
     * The message to send.
     *
     * This can be anything, but please set the `Content-Type` header accordingly.
     *
     * You can leave this empty if you want to send a message with no body.
     */
    body?: BodyInit;

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
     * Configure how many times you would like the delivery to be retried
     *
     * @default The maximum retry quota associated with your account.
     */
    retries?: number;
  }
  & (
    | {
      /**
       * Optionally specify a cron expression to repeatedly send this message to the destination.
       *
       * @default undefined
       */
      cron: string;
    }
    | {
      cron?: never;
    }
  );
export type PublishJsonRequest = Omit<PublishRequest, "body"> & {
  /**
   * The message to send.
   * This can be anything as long as it can be serialized to JSON.
   */
  body: unknown;
};

export type LogsRequest = {
  cursor?: number;
};

export type GetLogsRespone = {
  cursor?: number;
  logs: Log[];
};

export class Client {
  public http: Requester;

  public constructor(config: ClientConfig) {
    this.http = new HttpClient({
      baseUrl: config.baseUrl
        ? config.baseUrl.replace(/\/$/, "")
        : "https://qstash.upstash.io",
      authorization: config.token,
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
   * Access the endpoint API.
   *
   * Create, read, update or delete endpoints.
   */
  public get endpoints(): Endpoints {
    return new Endpoints(this.http);
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
   * Read or delete schedules.
   */
  public get schedules(): Schedules {
    return new Schedules(this.http);
  }
  public async publish<R extends PublishRequest>(
    req: R,
  ): Promise<PublishResponse<R>> {
    const destination = req.url ?? req.topic;
    if (!destination) {
      throw new Error("Either url or topic must be set");
    }

    const headers = new Headers(req.headers);

    if (req.delay) {
      headers.set("Upstash-Delay", req.delay.toFixed());
    }

    if (req.notBefore) {
      headers.set("Upstash-Not-Before", req.notBefore.toFixed());
    }

    if (req.deduplicationId) {
      headers.set("Upstash-Deduplication-Id", req.deduplicationId);
    }

    if (req.contentBasedDeduplication) {
      headers.set("Upstash-Content-Based-Deduplication", "true");
    }

    if (req.retries) {
      headers.set("Upstash-Retries", req.retries.toFixed());
    }

    if (req.cron) {
      headers.set("Upstash-Cron", req.cron);
    }

    const res = await this.http.request<PublishResponse<R>>({
      path: ["v1", "publish", destination],
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
  public async publishJSON<R extends PublishJsonRequest = PublishJsonRequest>(
    req: R,
  ): Promise<PublishResponse<R>> {
    const headers = new Headers(req.headers);
    headers.set("Content-Type", "application/json");

    const res = await this.publish({
      ...req,
      headers,
      body: JSON.stringify(req.body),
    } as PublishRequest);
    return res as unknown as PublishResponse<R>;
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
  public async logs(req?: LogsRequest): Promise<GetLogsRespone> {
    const query: Record<string, number> = {};
    if (req?.cursor && req.cursor > 0) {
      query["cursor"] = req.cursor;
    }
    const res = await this.http.request<GetLogsRespone>({
      path: ["v1", "logs"],
      method: "GET",
      query,
    });
    return res;
  }
}

type PublishResponse<PublishRequest> = PublishRequest extends { cron: string }
  ? { scheduleId: string }
  : { messageId: string };
