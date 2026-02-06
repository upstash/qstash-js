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

export type DLQFilter = {
  /**
   * Filter DLQ entries by message id
   */
  messageId?: string;

  /**
   * Filter DLQ entries by url
   */
  url?: string;

  /**
   * Filter DLQ entries by url group name
   */
  urlGroup?: string;

  /**
   * Filter DLQ entries by api name
   */
  api?: string;

  /**
   * Filter DLQ entries by queue name
   */
  queueName?: string;

  /**
   * Filter DLQ entries by schedule id
   */
  scheduleId?: string;

  /**
   * Filter DLQ entries by starting time, in milliseconds
   */
  fromDate?: number;

  /**
   * Filter DLQ entries by ending time, in milliseconds
   */
  toDate?: number;

  /**
   * Filter DLQ entries by label
   */
  label?: string;

  /**
   * Filter DLQ entries by HTTP status of the response
   */
  responseStatus?: number;

  /**
   * Filter DLQ entries by IP address of the publisher of the message
   */
  callerIp?: string;
};

export type DLQFilterPayload = Omit<DLQFilter, "urlGroup"> & { topicName?: string };

export class DLQ {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * List messages in the dlq
   */
  public async listMessages(options?: {
    cursor?: string;
    count?: number;
    filter?: DLQFilter;
  }): Promise<{
    messages: DlqMessage[];
    cursor?: string;
  }> {
    const filterPayload: DLQFilterPayload = {
      ...options?.filter,
      topicName: options?.filter?.urlGroup,
    };

    const messagesPayload = await this.http.request<DlqMessageGetPayload>({
      method: "GET",
      path: ["v2", "dlq"],
      query: {
        cursor: options?.cursor,
        count: options?.count,
        ...filterPayload,
      },
    });
    return {
      messages: messagesPayload.messages.map((message) => {
        return {
          ...message,
          urlGroup: message.topicName,
          ratePerSecond: "rate" in message ? message.rate : undefined,
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
      path: ["v2", "dlq", `?${DLQ.getDlqIdQueryParameter(request.dlqIds)}`],
    });
  }

  /**
   * Retry multiple messages from the dlq using their `dlqId`s
   */
  public async retry(request: { dlqIds: string | string[] }): Promise<{
    cursor: string;
    responses: { messageId: string }[];
  }> {
    const path = request.dlqIds ? `retry?${DLQ.getDlqIdQueryParameter(request.dlqIds)}` : "retry";
    return await this.http.request({
      method: "POST",
      path: ["v2", "dlq", path],
    });
  }

  /**
   * Converts DLQ ID(s) to query parameter string.
   *
   * @param dlqId - Single DLQ ID or array of DLQ IDs
   */
  private static getDlqIdQueryParameter(dlqId: string | string[]): string {
    const dlqIds = Array.isArray(dlqId) ? dlqId : [dlqId];
    const parametersArray: [string, string][] = dlqIds.map((id) => ["dlqIds", id]);
    return new URLSearchParams(parametersArray).toString();
  }
}
