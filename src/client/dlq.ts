import { Requester } from "./http";
import type { Message } from "./messages";

type DlqMessage = Message & {
  dlqId: string;
};

export class DLQ {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * List messages in the dlq
   */
  public async listMessages(): Promise<DlqMessage[]> {
    return await this.http.request<DlqMessage[]>({
      method: "GET",
      path: ["v2", "dlq", "messages"],
    });
  }

  /**
   * Remove a message from the dlq using it's `dlqId`
   */
  public async delete(dlqMessageId: string): Promise<void> {
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v2", "dlq", "messages", dlqMessageId],
    });
  }
}
