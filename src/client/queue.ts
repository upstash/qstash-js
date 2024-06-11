import type { PublishRequest, PublishResponse } from "./client";
import type { Requester } from "./http";
import { getRequestPath, prefixHeaders, processHeaders } from "./utils";

export type QueueResponse = {
  createdAt: number;
  updatedAt: number;
  name: string;
  parallelism: number;
  lag: number;
};

export type UpsertQueueRequest = {
  parallelism: number;
};

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
  public async upsert(request: UpsertQueueRequest): Promise<void> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor");
    }

    const body = {
      queueName: this.queueName,
      parallelism: request.parallelism,
    };

    await this.http.request({
      method: "POST",
      path: ["v2", "queues"],
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      parseResponseAsJson: false,
    });
  }

  /**
   * Get the queue details
   */
  public async get(): Promise<QueueResponse> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor");
    }

    return await this.http.request<QueueResponse>({
      method: "GET",
      path: ["v2", "queues", this.queueName],
    });
  }

  /**
   * List queues
   */
  public async list(): Promise<QueueResponse[]> {
    return await this.http.request<QueueResponse[]>({
      method: "GET",
      path: ["v2", "queues"],
    });
  }

  /**
   * Delete the queue
   */
  public async delete(): Promise<void> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor");
    }

    await this.http.request({
      method: "DELETE",
      path: ["v2", "queues", this.queueName],
      parseResponseAsJson: false,
    });
  }

  /**
   * Enqueue a message to a queue.
   */
  public async enqueue<TRequest extends PublishRequest>(
    request: TRequest
  ): Promise<PublishResponse<TRequest>> {
    if (!this.queueName) {
      throw new Error("Please provide a queue name to the Queue constructor");
    }

    const headers = processHeaders(request);
    const destination = getRequestPath(request);
    const response = await this.http.request<PublishResponse<TRequest>>({
      path: ["v2", "enqueue", this.queueName, destination],
      body: request.body,
      headers,
      method: "POST",
    });

    return response;
  }

  /**
   * Enqueue a message to a queue, serializing the body to JSON.
   */
  public async enqueueJSON<
    TBody = unknown,
    TRequest extends PublishRequest<TBody> = PublishRequest<TBody>,
  >(request: TRequest): Promise<PublishResponse<TRequest>> {
    //@ts-expect-error caused by undici and bunjs type overlap
    const headers = prefixHeaders(new Headers(request.headers));
    headers.set("Content-Type", "application/json");

    const response = await this.enqueue({
      ...request,
      body: JSON.stringify(request.body),
      headers,
    });

    // @ts-expect-error can't assign union type to conditional
    return response;
  }
}
