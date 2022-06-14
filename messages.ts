import { Requester } from "./http.ts";
import type { Log, Task } from "./types.ts";

export type GetMessageRequest = {
  id: string;
};
export type CancelMessageRequest = {
  id: string;
};
export type Message =
  & {
    messageID: string;
    header: Record<string, string[]>;
    body: string;
  }
  & (
    | {
      url: string;
      topicID?: never;
    }
    | {
      url?: never;
      topicID: string;
    }
  );
export type ListMessagesRequest = {
  cursor?: number;
};

export type ListMessagesResponse = {
  cursor?: number;
  messages: Message[];
};

export type ListLogsRequest = {
  // Message id
  id: string;
  cursor?: number;
};

export type ListLogsResponse = {
  cursor?: number;
  logs: Log[];
};

export type ListTasksRequest = {
  // Message id
  id: string;
  cursor?: number;
};

export type ListTasksResponse = {
  cursor?: number;
  logs: Task[];
};

export class Messages {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Get a message
   */
  public async get(req: GetMessageRequest): Promise<Message> {
    return await this.http.request<Message>({
      method: "GET",
      path: ["v1", "messages", req.id],
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * List your messages
   */
  public async list(req?: ListMessagesRequest): Promise<ListMessagesResponse> {
    return await this.http.request<ListMessagesResponse>({
      method: "GET",
      path: ["v1", "messages"],
      headers: { "Content-Type": "application/json" },
      query: { cursor: req?.cursor },
    });
  }

  /**
   * List logs from a message
   */
  public async logs(req: ListLogsRequest): Promise<ListLogsResponse> {
    return await this.http.request<ListLogsResponse>({
      method: "GET",
      path: ["v1", "messages", req.id, "logs"],
      headers: { "Content-Type": "application/json" },
      query: { cursor: req.cursor },
    });
  }

  /**
   * List tasks for a message
   */
  public async tasks(req: ListTasksRequest): Promise<ListTasksResponse> {
    return await this.http.request<ListTasksResponse>({
      method: "GET",
      path: ["v1", "messages", req.id, "tasks"],
      headers: { "Content-Type": "application/json" },
      query: { cursor: req.cursor },
    });
  }

  /**
   * Cancel a topic by name or ID.
   */
  public async delete(req: CancelMessageRequest): Promise<void> {
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v1", "messages", req.id],
      headers: { "Content-Type": "application/json" },
    });
  }
}
