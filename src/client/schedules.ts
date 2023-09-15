import { Requester } from "./http";

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
};

export type CreateScheduleRequest = {
  /**
   * Either a URL or topic name
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
   * In case your destination server is unavaialble or returns a status code outside of the 200-299
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
   * The method to use when sending a request to your API
   *
   * @default `POST`
   */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

  /**
   * Specify a cron expression to repeatedly send this message to the destination.
   */
  cron: string;
};

export class Schedules {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Create a schedule
   */
  public async create(req: CreateScheduleRequest): Promise<{ scheduleId: string }> {
    const headers = new Headers(req.headers);

    const ignoredHeaders = new Set([
      "content-type",
      "upstash-cron",
      "upstash-method",
      "upstash-delay",
      "upstash-retries",
      "upstash-callback"
    ]);
    
    // Get keys of headers that need to be prefixed
    const keysToBePrefixed = Array.from(headers.keys()).filter(
      key => !ignoredHeaders.has(key.toLowerCase()) && !key.toLowerCase().startsWith("upstash-forward-")
    );

    // Add the prefixed headers
    for (const key of keysToBePrefixed) {
      const value = headers.get(key);
      if (value !== null) {
        headers.set(`Upstash-Forward-${key}`, value);
      }
    }

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    headers.set("Upstash-Cron", req.cron);

    if (typeof req.method !== "undefined") {
      headers.set("Upstash-Method", req.method);
    }

    if (typeof req.delay !== "undefined") {
      headers.set("Upstash-Delay", `${req.delay.toFixed()}s`);
    }

    if (typeof req.retries !== "undefined") {
      headers.set("Upstash-Retries", req.retries.toFixed());
    }

    if (typeof req.callback !== "undefined") {
      headers.set("Upstash-Callback", req.callback);
    }

    return await this.http.request({
      method: "POST",
      headers,
      path: ["v2", "schedules", req.destination],
      body: req.body,
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
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v2", "schedules", scheduleId],
    });
  }
}
