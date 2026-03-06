import type { Requester } from "./http";
import type { Message } from "./messages";
import type { DLQBulkActionFilters, DLQListFilters } from "./filter-types";
import { buildBulkActionFilterPayload, normalizeCursor } from "./utils";

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

export type DLQFilter = DLQListFilters;

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
    /** Defaults to `latestFirst` */
    order?: "earliestFirst" | "latestFirst";
    trimBody?: number;
    filter?: DLQListFilters;
  }): Promise<{
    messages: DlqMessage[];
    cursor?: string;
  }> {
    const { urlGroup, ...restFilter } = options?.filter ?? {};
    const filterPayload = {
      ...restFilter,
      ...(urlGroup === undefined ? {} : { topicName: urlGroup }),
    };

    const messagesPayload = await this.http.request<DlqMessageGetPayload>({
      method: "GET",
      path: ["v2", "dlq"],
      query: {
        cursor: options?.cursor,
        count: options?.count,
        order: options?.order,
        trimBody: options?.trimBody,
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
   * Remove messages from the dlq.
   *
   * Can be called with:
   * - A single dlqId: `delete("id")`
   * - An array of dlqIds: `delete(["id1", "id2"])`
   * - An object with dlqIds: `delete({ dlqIds: ["id1", "id2"] })`
   * - A filter object: `delete({ url: "https://example.com", label: "label" })`
   * - All messages: `delete({ all: true })`
   *
   * Note: passing an empty array returns `{ deleted: 0 }` without making a request.
   */
  public async delete(
    request: string | string[] | DLQBulkActionFilters
  ): Promise<{ deleted: number; cursor?: string }> {
    // Handle single string via single-item endpoint to preserve 404 semantics.
    // For backwards compatibility
    if (typeof request === "string") {
      await this.http.request({
        method: "DELETE",
        path: ["v2", "dlq", request],
        parseResponseAsJson: false,
      });
      return { deleted: 1 };
    }

    // Handle string[] — convert to { dlqIds } for backwards compatibility
    if (Array.isArray(request)) {
      if (request.length === 0) return { deleted: 0 };
      request = { dlqIds: request };
    }

    return normalizeCursor(
      await this.http.request({
        method: "DELETE",
        path: ["v2", "dlq"],
        query: buildBulkActionFilterPayload(request),
      })
    );
  }

  /**
   * Remove multiple messages from the dlq using their `dlqId`s
   *
   * @deprecated Use `delete` instead
   */
  public async deleteMany(request: {
    dlqIds: string[];
  }): Promise<{ deleted: number; cursor?: string }> {
    return await this.delete(request);
  }

  /**
   * Retry messages from the dlq.
   *
   * Can be called with:
   * - A single dlqId: `retry("id")`
   * - An array of dlqIds: `retry(["id1", "id2"])`
   * - An object with dlqIds: `retry({ dlqIds: ["id1", "id2"] })`
   * - A filter object: `retry({ url: "https://example.com", label: "label" })`
   * - All messages: `retry({ all: true })`
   *
   * Note: passing an empty array returns `{ responses: [] }` without making a request.
   */
  public async retry(
    request: string | string[] | DLQBulkActionFilters
  ): Promise<{ cursor?: string; responses: { messageId: string }[] }> {
    // Handle string or string[] — convert to { dlqIds } for backwards compatibility
    if (typeof request === "string" || Array.isArray(request)) {
      const dlqIds = Array.isArray(request) ? request : [request];
      if (dlqIds.length === 0) return { responses: [] };
      request = { dlqIds };
    }

    return normalizeCursor(
      await this.http.request<{ cursor?: string; responses: { messageId: string }[] }>({
        method: "POST",
        path: ["v2", "dlq", "retry"],
        query: buildBulkActionFilterPayload(request),
      })
    );
  }
}
