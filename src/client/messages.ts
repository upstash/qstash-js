import type { PublishRequest } from "./client";
import type { Requester } from "./http";
import type { HTTPMethods, QStashCommonFilters } from "./types";

export type Message = {
  /**
   * A unique identifier for this message.
   */
  messageId: string;

  /**
   * The url group name if this message was sent to a urlGroup.
   */
  urlGroup?: string;

  /**
   * Deprecated. The topic name if this message was sent to a urlGroup. Use urlGroup instead
   */
  topicName?: string;

  /**
   * The url where this message is sent to.
   */
  url: string;

  /**
   * The endpoint name of the message if the endpoint is given a
   * name within the url group.
   */
  endpointName?: string;

  /**
   * The api name if this message was sent to an api
   */
  api?: string;

  /**
   * The http method used to deliver the message
   */
  method?: HTTPMethods;

  /**
   * The http headers sent along with the message to your API.
   */
  header?: Record<string, string[]>;

  /**
   * The http body sent to your API
   */
  body?: string;

  /**
   * The base64 encoded body if the body contains non-UTF-8 characters,
   * `None` otherwise.
   */
  bodyBase64?: string;

  /**
   * Maxmimum number of retries.
   */
  maxRetries?: number;

  /**
   * The retry delay expression for this message,
   * if retry_delay was set when publishing the message.
   */
  retryDelayExpression?: PublishRequest["retryDelay"];

  /**
   * A unix timestamp (milliseconds) after which this message may get delivered.
   */
  notBefore?: number;

  /**
   * A unix timestamp (milliseconds) when this messages was created.
   */
  createdAt: number;

  /**
   * The callback url if configured.
   */
  callback?: string;

  /**
   * The failure callback url if configured.
   */
  failureCallback?: string;

  /**
   * The queue name if this message was sent to a queue.
   */
  queueName?: string;

  /**
   * The scheduleId of the message if the message is triggered by a schedule
   */
  scheduleId?: string;

  /**
   * IP address of the publisher of this message
   */
  callerIp?: string;

  /**
   * flow control key
   */
  flowControlKey: string;
  /**
   * number of requests which can be active with the same flow control key
   */
  parallelism?: number;
  /**
   * number of requests to activate per second with the same flow control key
   *
   * @deprecated use rate instead
   */
  ratePerSecond?: number;
  /**
   * number of requests to activate within the period with the same flow control key.
   * Default period is a second.
   */
  rate?: number;
  /**
   * The time interval during which the specified `rate` of requests can be activated
   * using the same flow control key.
   *
   * In seconds.
   */
  period?: number;

  /**
   * The label assigned to the message for filtering purposes.
   */
  label?: string;
};

export type MessagePayload = Omit<Message, "urlGroup"> & { topicName: string };

export class Messages {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Get a message
   */
  public async get(messageId: string): Promise<Message> {
    const messagePayload = await this.http.request<MessagePayload>({
      method: "GET",
      path: ["v2", "messages", messageId],
    });
    const message: Message = {
      ...messagePayload,
      urlGroup: messagePayload.topicName,
      ratePerSecond: "rate" in messagePayload ? messagePayload.rate : undefined,
    };
    return message;
  }

  /**
   * Cancel messages.
   *
   * Can be called with:
   * - A single messageId: `delete("id")`
   * - An array of messageIds: `delete(["id1", "id2"])`
   * - A filter object: `delete({ flowControlKey: "key", label: "label" })`
   */
  public async delete(
    request: string | string[] | QStashCommonFilters
  ): Promise<{ cancelled: number }> {
    // Handle single string - original delete behavior
    if (typeof request === "string") {
      return await this.http.request({
        method: "DELETE",
        path: ["v2", "messages", request],
        parseResponseAsJson: false,
      });
    }

    // Handle string[] - bulk cancel by messageIds
    if (Array.isArray(request)) {
      const result = (await this.http.request({
        method: "DELETE",
        path: ["v2", "messages"],
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: request }),
      })) as { cancelled: number };
      return result;
    }

    // Handle filters (QStashCommonFilters)
    const { urlGroup, ...rest } = request;
    const result = (await this.http.request({
      method: "DELETE",
      path: ["v2", "messages"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rest,
        ...(urlGroup ? { topicName: urlGroup } : {}),
        ...(request.fromDate ? { fromDate: Number(request.fromDate) } : {}),
        ...(request.toDate ? { toDate: Number(request.toDate) } : {}),
      }),
    })) as { cancelled: number };
    return result;
  }

  /**
   * Cancel multiple messages by their messageIds.
   *
   * @deprecated Use `delete(messageIds: string[])` instead
   */
  public async deleteMany(messageIds: string[]): Promise<{ cancelled: number }> {
    return await this.delete(messageIds);
  }

  /**
   * Cancel all messages, optionally filtered.
   *
   * @deprecated Use `delete(filters: QStashCommonFilters)` for filtered cancel,
   * or `delete({})` to cancel all
   */
  public async deleteAll(filters?: QStashCommonFilters): Promise<{ cancelled: number }> {
    return await this.delete(filters ?? {});
  }
}
