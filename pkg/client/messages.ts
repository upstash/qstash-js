import { Requester } from "./http";

type Message = {};

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
    });
  }
}
