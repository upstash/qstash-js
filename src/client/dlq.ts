import type { Requester } from "./http";
import type { Message } from "./messages";

type DlqMessage = Message & {
  /**
   * The unique id within the DLQ
   */
  dlqId: string;

  /**
   * The HTTP status code of the last failed delivery attempt
   */
  responseStatus?: number;

  /**
   * The response headers of the last failed delivery attempt
   */
  responseHeader?: Record<string, string[]>;

  /**
   * The response body of the last failed delivery attempt if it is
   * composed of UTF-8 characters only, `None` otherwise.
   */
  responseBody?: string;

  /**
   * The base64 encoded response body of the last failed delivery attempt
   * if the response body contains non-UTF-8 characters, `None` otherwise.
   */
  responseBodyBase64?: string;
};

export type DlqMessagePayload = Omit<DlqMessage, "urlGroup"> & { topicName: string };

export type DlqMessageGetPayload = {
  messages: DlqMessagePayload[];
  cursor?: string;
};

export class DLQ {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * List messages in the dlq
   */
  public async listMessages(options?: { cursor?: string }): Promise<{
    messages: DlqMessage[];
    cursor?: string;
  }> {
    const messagesPayload = await this.http.request<DlqMessageGetPayload>({
      method: "GET",
      path: ["v2", "dlq"],
      query: { cursor: options?.cursor },
    });
    return {
      messages: messagesPayload.messages.map((message) => {
        return {
          ...message,
          urlGroup: message.topicName,
        };
      }),
      cursor: messagesPayload.cursor,
    };
  }

  /**
   * Remove a message from the dlq using it's `dlqId`
   */
  public async delete(dlqMessageId: string): Promise<void> {
    return await this.http.request({
      method: "DELETE",
      path: ["v2", "dlq", dlqMessageId],
      parseResponseAsJson: false, // there is no response
    });
  }

  /**
   * Remove multiple messages from the dlq using their `dlqId`s
   */
  public async deleteMany(request: { dlqIds: string[] }): Promise<{ deleted: number }> {
    return await this.http.request({
      method: "DELETE",
      path: ["v2", "dlq"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dlqIds: request.dlqIds }),
    });
  }
}
