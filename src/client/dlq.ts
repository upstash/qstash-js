import type { Requester } from "./http";
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
  public async listMessages(opts?: { cursor?: string }): Promise<{
    messages: DlqMessage[];
    cursor?: string;
  }> {
    return await this.http.request({
      method: "GET",
      path: ["v2", "dlq"],
      query: { cursor: opts?.cursor },
    });
  }

  /**
   * Remove a message from the dlq using it's `dlqId`
   */
  public async delete(dlqMessageId: string): Promise<void> {
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v2", "dlq", dlqMessageId],
      parseResponseAsJson: false, // there is no response
    });
  }

  /**
   * Remove multiple messages from the dlq using their `dlqId`s
   */
  public async deleteMany(req: {
    dlqIds: string[];
  }): Promise<{ deleted: number }> {
    return await this.http.request({
      method: "DELETE",
      path: ["v2", "dlq"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dlqIds: req.dlqIds }),
    });
  }
}
