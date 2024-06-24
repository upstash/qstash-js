import { prefixHeaders } from "./utils";
import type { Requester } from "./http";
import type { BodyInit, HeadersInit } from "./types";

export type Schedule = {
  scheduleId: string;
  cron: string;
  createdAt: number;
  destination: string;
  method: string;
  header?: Record<string, string[]>;
  body?: string;
  retries: number;
  delay?: number;
  callback?: string;
  failureCallback?: string;
  isPaused: true | undefined;
};

export type CreateScheduleRequest = {
  /**
   * Either a URL or urlGroup name
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
   * In case your destination server is unavailable or returns a status code outside of the 200-299
   * range, we will retry the request after a certain amount of time.
   *
   * Configure how many times you would like the delivery to be retried
   *
   * @default The maximum retry quota associated with your account.
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

  /**
   * Specify a cron expression to repeatedly send this message to the destination.
   */
  cron: string;

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
  timeout?: number;
};

export class Schedules {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Create a schedule
   */
  public async create(request: CreateScheduleRequest): Promise<{ scheduleId: string }> {
    //@ts-expect-error caused by undici and bunjs type overlap
    const headers = prefixHeaders(new Headers(request.headers));

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    headers.set("Upstash-Cron", request.cron);

    if (request.method !== undefined) {
      headers.set("Upstash-Method", request.method);
    }

    if (request.delay !== undefined) {
      headers.set("Upstash-Delay", `${request.delay.toFixed(0)}s`);
    }

    if (request.retries !== undefined) {
      headers.set("Upstash-Retries", request.retries.toFixed(0));
    }

    if (request.callback !== undefined) {
      headers.set("Upstash-Callback", request.callback);
    }

    if (request.failureCallback !== undefined) {
      headers.set("Upstash-Failure-Callback", request.failureCallback);
    }

    if (request.timeout !== undefined) {
      headers.set("Upstash-Timeout", `${request.timeout}s`);
    }

    return await this.http.request({
      method: "POST",
      headers,
      path: ["v2", "schedules", request.destination],
      body: request.body,
    });
  }

  /**
   * Get a schedule
   */
  public async get(scheduleId: string): Promise<Schedule> {
    return await this.http.request<Schedule>({
      method: "GET",
      path: ["v2", "schedules", scheduleId],
    });
  }

  /**
   * List your schedules
   */
  public async list(): Promise<Schedule[]> {
    return await this.http.request<Schedule[]>({
      method: "GET",
      path: ["v2", "schedules"],
    });
  }

  /**
   * Delete a schedule
   */
  public async delete(scheduleId: string): Promise<void> {
    return await this.http.request({
      method: "DELETE",
      path: ["v2", "schedules", scheduleId],
      parseResponseAsJson: false,
    });
  }

  /**
   * Pauses the schedule.
   *
   * A paused schedule will not deliver messages until
   * it is resumed.
   */
  public async pause({ schedule }: { schedule: string }) {
    await this.http.request({
      method: "PATCH",
      path: ["v2", "schedules", schedule, "pause"],
      parseResponseAsJson: false,
    });
  }

  /**
   * Resumes the schedule.
   */
  public async resume({ schedule }: { schedule: string }) {
    await this.http.request({
      method: "PATCH",
      path: ["v2", "schedules", schedule, "resume"],
      parseResponseAsJson: false,
    });
  }
}
