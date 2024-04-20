import type { PublishRequest, PublishResponse } from "./client";
import type { Requester } from "./http";
import { prefixHeaders, processHeaders } from "./utils";

export type TQueue = {
  createdAt: number,
  updatedAt: number,
  name: string,
  parallelism: number,
  lag: number
}

export type UpsertQueueRequest = {
  parallelism: number,
}

export type EnqueueRequest = {
  publishRequest: PublishRequest;
  queueName: string;
};

export class Queue {
  private readonly http: Requester;
  private readonly queueName: string;

  constructor(http: Requester, queueName: string) {
    this.http = http;
    this.queueName = queueName;
  }

  /**
   * Create or update the queue
   */
  public async upsert(req: UpsertQueueRequest): Promise<void> {
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
    })
  }

  /**
   * Get the queue details
   */
  public async get(): Promise<TQueue> {
    return await this.http.request<TQueue>({
      method: "GET",
      path: ["v2", "queues", this.queueName],
    })
  }

  /**
   * List queues
   */
  public async list(): Promise<TQueue[]> {
    return await this.http.request<TQueue[]>({
      method: "GET",
      path: ["v2", "queues"],
    })
  }

  /**
   * Delete the queue
   */
  public async delete(): Promise<void> {
    await this.http.request({
      method: "DELETE",
      path: ["v2", "queues", this.queueName],
    })
  }

  /**
   * Enqueue a message to a queue.
   */
  public async enqueue(req: EnqueueRequest): Promise<PublishResponse<PublishRequest>> {
    const headers = processHeaders(req.publishRequest);
    const destination = req.publishRequest.url ?? req.publishRequest.topic;
    const res = await this.http.request<PublishResponse<PublishRequest>>({
      path: ["v2", "enqueue", req.queueName, destination],
      body: req.publishRequest.body,
      headers,
      method: "POST",
    });

    return res;
  }

  /**
   * Enqueue a message to a queue, serializing the body to JSON.
   */
  public async enqueueJSON<TBody = unknown>(
    req: EnqueueRequest & { publishRequest: PublishRequest<TBody> }
  ): Promise<PublishResponse<PublishRequest<TBody>>> {
    const headers = prefixHeaders(new Headers(req.publishRequest.headers));
    headers.set("Content-Type", "application/json");

    const res = await this.enqueue({
      ...req,
      publishRequest: {
        ...req.publishRequest,
        headers,
        body: JSON.stringify(req.publishRequest.body),
      },
    });

    return res;
  }
}
