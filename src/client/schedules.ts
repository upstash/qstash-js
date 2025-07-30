/* eslint-disable @typescript-eslint/no-deprecated */
import { prefixHeaders, wrapWithGlobalHeaders } from "./utils";
import type { Requester } from "./http";
import type { BodyInit, FlowControl, HeadersInit, HTTPMethods } from "./types";
import type { Duration } from "./duration";
import { QstashError } from "./error";
import type { PublishRequest } from "./client";

export type Schedule = {
  scheduleId: string;
  cron: string;
  createdAt: number;
  destination: string;
  method: string;
  header?: Record<string, string[]>;
  body?: string;
  bodyBase64?: string;
  retries: number;
  delay?: number;
  callback?: string;
  failureCallback?: string;
  callerIp?: string;
  isPaused: boolean;
  queueName?: string;
  flowControlKey?: string;
  parallelism?: number;
  rate?: number;
  /**
   * @deprecated use rate instead
   */
  ratePerSecond?: number;

  /**
   * The time interval during which the specified `rate` of requests can be activated
   * using the same flow control key.
   *
   * In seconds.
   */
  period?: number;
  /**
   * The retry delay expression for this schedule,
   * if retry_delay was set when creating the schedule.
   */
  retryDelayExpression?: PublishRequest["retryDelay"];
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
  delay?: Duration | number;

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
  method?: HTTPMethods;

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
  timeout?: Duration | number;

  /**
   * Schedule id to use.
   *
   * Can be used to update the settings of an existing schedule.
   *
   * @default undefined
   */
  scheduleId?: string;

  /**
   * Queue name to schedule the message over.
   */
  queueName?: string;

  /**
   * Settings for controlling the number of active requests
   * and number of requests per second with the same key.
   */
  flowControl?: FlowControl;
} & Pick<PublishRequest, "retryDelay">;

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
      // Handle both string (Duration type) and number inputs for delay
      if (typeof request.delay === "string") {
        // If delay is a string (e.g., "20s", "1h"), use it directly
        headers.set("Upstash-Delay", request.delay);
      } else {
        // If delay is a number, convert it to seconds and append 's'
        headers.set("Upstash-Delay", `${request.delay.toFixed(0)}s`);
      }
    }

    if (request.retries !== undefined) {
      headers.set("Upstash-Retries", request.retries.toFixed(0));
    }

    if (request.retryDelay !== undefined) {
      headers.set("Upstash-Retry-Delay", request.retryDelay);
    }

    if (request.callback !== undefined) {
      headers.set("Upstash-Callback", request.callback);
    }

    if (request.failureCallback !== undefined) {
      headers.set("Upstash-Failure-Callback", request.failureCallback);
    }

    if (request.timeout !== undefined) {
      // Handle both string (Duration type) and number inputs for timeout
      if (typeof request.timeout === "string") {
        // If timeout is a string (e.g., "20s", "1h"), use it directly
        headers.set("Upstash-Timeout", request.timeout);
      } else {
        // If timeout is a number, convert it to seconds and append 's'
        headers.set("Upstash-Timeout", `${request.timeout}s`);
      }
    }

    if (request.scheduleId !== undefined) {
      headers.set("Upstash-Schedule-Id", request.scheduleId);
    }

    if (request.queueName !== undefined) {
      headers.set("Upstash-Queue-Name", request.queueName);
    }

    if (request.flowControl?.key) {
      const parallelism = request.flowControl.parallelism?.toString();
      const rate = (request.flowControl.rate ?? request.flowControl.ratePerSecond)?.toString();
      const period =
        typeof request.flowControl.period === "number"
          ? `${request.flowControl.period}s`
          : request.flowControl.period;

      const controlValue = [
        parallelism ? `parallelism=${parallelism}` : undefined,
        rate ? `rate=${rate}` : undefined,
        period ? `period=${period}` : undefined,
      ].filter(Boolean);

      if (controlValue.length === 0) {
        throw new QstashError(
          "Provide at least one of parallelism or ratePerSecond for flowControl"
        );
      }

      headers.set("Upstash-Flow-Control-Key", request.flowControl.key);
      headers.set("Upstash-Flow-Control-Value", controlValue.join(", "));
    }

    return await this.http.request({
      method: "POST",
      headers: wrapWithGlobalHeaders(headers, this.http.headers, this.http.telemetryHeaders),
      path: ["v2", "schedules", request.destination],
      body: request.body,
    });
  }

  /**
   * Get a schedule
   */
  public async get(scheduleId: string): Promise<Schedule> {
    const schedule = await this.http.request<Schedule>({
      method: "GET",
      path: ["v2", "schedules", scheduleId],
    });

    if ("rate" in schedule) schedule.ratePerSecond = schedule.rate;

    return schedule;
  }

  /**
   * List your schedules
   */
  public async list(): Promise<Schedule[]> {
    const schedules = await this.http.request<Schedule[]>({
      method: "GET",
      path: ["v2", "schedules"],
    });

    for (const schedule of schedules) {
      if ("rate" in schedule) schedule.ratePerSecond = schedule.rate;
    }

    return schedules;
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
