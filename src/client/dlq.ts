import type { Requester } from "./http";
import type { Message } from "./messages";
import type { DLQBulkActionFilters, DLQListRequest } from "./filter-types";
import { buildBulkActionFilterPayload, normalizeCursor, renameUrlGroup } from "./utils";

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
   *
   * Can be called with:
   * - Filters: `listMessages({ filter: { url: "https://example.com" } })`
   * - DLQ IDs: `listMessages({ dlqIds: ["id1", "id2"] })`
   * - No filter (list all): `listMessages()`
   */
  public async listMessages(
    options: {
      count?: number;
    } & DLQListRequest = {}
  ): Promise<{
    messages: DlqMessage[];
    cursor?: string;
  }> {
    const query = {
      count: options.count,
      ...("dlqIds" in options
        ? { dlqIds: options.dlqIds }
        : { ...renameUrlGroup(options.filter ?? {}), cursor: options.cursor }),
    };

    const messagesPayload = await this.http.request<DlqMessageGetPayload>({
      method: "GET",
      path: ["v2", "dlq"],
      query,
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
   * - A filter object: `delete({ filter: { url: "https://example.com", label: "label" } })`
   * - All messages: `delete({ all: true })`
   *
   * Pass `count` to limit the number of messages processed per call.
   * `count` defaults to 250 to avoid database lock issues.
   * Call in a loop until `deleted` is 0:
   *
   * ```ts
   * let deleted: number;
   * do {
   *   ({ deleted } = await dlq.delete({ all: true, count: 250 }));
   * } while (deleted > 0);
   * ```
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

    // Early return for empty string[]
    if (Array.isArray(request) && request.length === 0) return { deleted: 0 };
    const filters = Array.isArray(request) ? { dlqIds: request } : request;

    return await this.http.request({
      method: "DELETE",
      path: ["v2", "dlq"],
      query: buildBulkActionFilterPayload(filters),
    });
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
   * - A filter object: `retry({ filter: { url: "https://example.com", label: "label" } })`
   * - All messages: `retry({ all: true })`
   *
   * Pass `count` to limit the number of messages processed per call.
   * `count` defaults to 250 to avoid database lock issues.
   * Call in a loop until `responses` is empty:
   *
   * ```ts
   * let responses: { messageId: string }[];
   * do {
   *   ({ responses } = await dlq.retry({ all: true, count: 250 }));
   * } while (responses.length > 0);
   * ```
   */
  public async retry(
    request: string | string[] | DLQBulkActionFilters
  ): Promise<{ cursor?: string; responses: { messageId: string }[] }> {
    // Handle string or string[] (the object form is caught in buildBulkActionFilterPayload)
    if (typeof request === "string") request = [request];
    if (Array.isArray(request) && request.length === 0) return { responses: [] };
    const filters: DLQBulkActionFilters = Array.isArray(request) ? { dlqIds: request } : request;

    return normalizeCursor(
      await this.http.request<{ cursor?: string; responses: { messageId: string }[] }>({
        method: "POST",
        path: ["v2", "dlq", "retry"],
        query: buildBulkActionFilterPayload(filters),
      })
    );
  }
}
