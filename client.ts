import { HttpClient, Requester } from "./http.ts";
import { Topics } from "./topics.ts";
import { Messages } from "./messages.ts";
import { Schedules } from "./schedules.ts";
import { Endpoints } from "./endpoints.ts";
import type { Log } from "./types.ts";
export type ClientConfig = {
  /**
   * Url of the qstash api server
   *
   * @default "https://qstash.upstash.io"
   */
  baseUrl?: string;

  /**
   * The authorization token from the upstash console.
   */
  authorization: string;
};

type PublishRequest = {
  /**
   * The url of a publicly accessible server where you want to send this message to.
   * The url must have a valid scheme (http or https).
   *
   * Alternatively, you can specify a topic name or id instead of a url to publish to a topic.
   */
  destination: string;

  /**
   * The message to send.
   *
   * This can be anything, but please set the `Content-Type` header accordingly.
   *
   * You can leave this empty if you want to send a message with no body.
   */
  body?: BodyInit;

  /**
   * Optionally specify a cron expression to repeatedly send this message to the destination.
   *
   * @default undefined
   */
  cron?: string;

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
   * We will no longer try to deliver the message after this time
   *
   * Unix timestamp with second precicion
   *
   * @default undefined
   */
  deadline?: number;

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
  deduplicationID?: string;

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
      authorization: config.authorization,
    });
  }

  public get topics(): Topics {
    return new Topics(this.http);
  }
  public get endpoints(): Endpoints {
    return new Endpoints(this.http);
  }

  public get messages(): Messages {
    return new Messages(this.http);
  }
  public get schedules(): Schedules {
    return new Schedules(this.http);
  }
  public async publish<R extends PublishRequest = PublishRequest>(
    req: R,
  ): Promise<PublishResponse<R>> {
    const res = await this.http.request<PublishResponse<R>>({
      path: ["v1", "publish", req.destination],
      body: req.cron,
      headers: req.headers,
      method: "POST",
    });
    return res;
  }

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
  ? { scheduleID: string }
  : { messageID: string };
