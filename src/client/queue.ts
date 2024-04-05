import { Requester } from "./http";

export type Queue = {
  createdAt: number,
  updatedAt: number,
  name: string,
  parallelism: number,
  lag: number
}

export type UpsertQueueRequest = {
  queueName: string,
  parallelism: number,
}

export class Queues {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Create or update a queue
   */
  public async upsert(req: UpsertQueueRequest): Promise<void> {
    await this.http.request({
      method: "POST",
      path: ["v2", "queues"],
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
    })
  }

  /**
   * Get a queue
   */
  public async get(queueName: string): Promise<Queue> {
    return await this.http.request<Queue>({
      method: "GET",
      path: ["v2", "queues", queueName],
    })
  }

  /**
   * List queues
   */
  public async list(): Promise<Queue[]> {
    return await this.http.request<Queue[]>({
      method: "GET",
      path: ["v2", "queues"],
    })
  }

  /**
   * Delete a queue
   */
  public async delete(queueName: string): Promise<void> {
    await this.http.request({
      method: "DELETE",
      path: ["v2", "queues", queueName],
    })
  }

}
