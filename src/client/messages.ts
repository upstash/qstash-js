import { Requester } from "./http";

export type Message = {
  /**
   * A unique identifier for this message.
   */
  messageId: string;

  /**
   * The topic name if this message was sent to a topic.
   */
  topicName?: string;

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
   * A unix timestamp (milliseconds) when this messages was crated.
   */
  createdAt: number;

  /**
   * The callback url if configured.
   */
  callback?: string;
};

export class Messages {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Get a message
   */
  public async get(messageId: string): Promise<Message> {
    return await this.http.request<Message>({
      method: "GET",
      path: ["v2", "messages", messageId],
    });
  }

  /**
   * Cancel a message
   */
  public async delete(messageId: string): Promise<void> {
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v2", "messages", messageId],
      parseResponseAsJson: false
    });
  }
}
