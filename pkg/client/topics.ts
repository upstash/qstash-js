import { Requester } from "./http.ts";

export type CreateTopicRequest = {
  /**
   * The name of the topic.
   * Must be unique and only contain alphanumeric, hyphen, underscore and periods.
   */
  name: string;
};

export type GetTopicRequest =
  | {
    name: string;
    id?: never;
  }
  | {
    id: string;
    name?: never;
  };

export type UpdateTopicRequest = {
  id: string;
  name?: string;
};
export type DeleteTopicRequest =
  | {
    name: string;
    id?: never;
  }
  | {
    id: string;
    name?: never;
  };
export type Topic = {
  /**
   * id for this topic
   */
  id: string;

  /**
   * The name of this topic.
   */
  name: string;

  /**
   * A list of all subscribed endpoints
   */
  endpointIds: string[];
};

export class Topics {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Create a new topic with the given name.
   */
  public async create(req: CreateTopicRequest): Promise<Topic> {
    return await this.http.request<Topic>({
      method: "POST",
      path: ["v1", "topics"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: req.name }),
    });
  }

  /**
   * Get a list of all topics.
   */
  public async list(): Promise<Topic[]> {
    return await this.http.request<Topic[]>({
      method: "GET",
      path: ["v1", "topics"],
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get a single topic by name or id.
   */
  public async get(req: GetTopicRequest): Promise<Topic> {
    const idOrName = req.id ?? req.name;
    if (!idOrName) {
      throw new Error("Either id or name must be provided");
    }
    return await this.http.request<Topic>({
      method: "GET",
      path: ["v1", "topics", idOrName],
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Update a topic
   */
  public async update(req: UpdateTopicRequest): Promise<Topic> {
    return await this.http.request<Topic>({
      method: "PUT",
      path: ["v1", "topics", req.id],
      body: JSON.stringify({ name: req.name }),
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Delete a topic by name or id.
   */
  public async delete(req: DeleteTopicRequest): Promise<void> {
    const idOrName = req.id ?? req.name;
    if (!idOrName) {
      throw new Error("Either id or name must be provided");
    }
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v1", "topics", idOrName],
      headers: { "Content-Type": "application/json" },
    });
  }
}
