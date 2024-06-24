import type { Requester } from "./http";

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
   * The url where this message is sent to.
   */
  url: string;

  /**
   * The http method used to deliver the message
   */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

  /**
   * The http headers sent along with the message to your API.
   */
  header?: Record<string, string[]>;

  /**
   * The http body sent to your API
   */
  body?: string;

  /**
   * Maxmimum number of retries.
   */
  maxRetries?: number;

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
    };
    return message;
  }

  /**
   * Cancel a message
   */
  public async delete(messageId: string): Promise<void> {
    return await this.http.request({
      method: "DELETE",
      path: ["v2", "messages", messageId],
      parseResponseAsJson: false,
    });
  }
}
