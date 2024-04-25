import type { PublishRequest, PublishResponse } from "./client";
import type { Requester } from "./http";
import { prefixHeaders, processHeaders } from "./utils";

export type QueueResponse = {
  createdAt: number,
  updatedAt: number,
  name: string,
  parallelism: number,
  lag: number
}

export type UpsertQueueRequest = {
  parallelism: number,
}

export type EnqueueRequest = PublishRequest

export class Queue {
  private readonly http: Requester;
  private readonly queueName: string | undefined;

  constructor(http: Requester, queueName?: string) {
    this.http = http;
    this.queueName = queueName;
  }

  /**
   * Create or update the queue
   */
  public async upsert(req: UpsertQueueRequest): Promise<void> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor")
    }

    const body = {
      queueName: this.queueName,
      parallelism: req.parallelism
    }

    await this.http.request({
      method: "POST",
      path: ["v2", "queues"],
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      parseResponseAsJson: false,
    })
  }

  /**
   * Get the queue details
   */
  public async get(): Promise<QueueResponse> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor")
    }

    return await this.http.request<QueueResponse>({
      method: "GET",
      path: ["v2", "queues", this.queueName],
    })
  }

  /**
   * List queues
   */
  public async list(): Promise<QueueResponse[]> {
    return await this.http.request<QueueResponse[]>({
      method: "GET",
      path: ["v2", "queues"],
    })
  }

  /**
   * Delete the queue
   */
  public async delete(): Promise<void> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor")
    }

    await this.http.request({
      method: "DELETE",
      path: ["v2", "queues", this.queueName],
      parseResponseAsJson: false,
    })
  }

  /**
   * Enqueue a message to a queue.
   */
  public async enqueue(req: EnqueueRequest): Promise<PublishResponse<PublishRequest>> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor")
    }

    const headers = processHeaders(req);
    const destination = req.url ?? req.topic;
    const res = await this.http.request<PublishResponse<PublishRequest>>({
      path: ["v2", "enqueue", this.queueName, destination],
      body: req.body,
      headers,
      method: "POST",
    });

    return res;
  }

  /**
   * Enqueue a message to a queue, serializing the body to JSON.
   */
  public async enqueueJSON<TBody = unknown>(
    req: PublishRequest<TBody>
  ): Promise<PublishResponse<PublishRequest<TBody>>> {
    const headers = prefixHeaders(new Headers(req.headers));
    headers.set("Content-Type", "application/json");

    const res = await this.enqueue({
      ...req,
      body: JSON.stringify(req.body),
      headers,
    })

    return res;
  }
}
