import { Requester } from "./http";

export type Endpoint = {
  /**
   * The name of the endpoint (optional)
   */
  name?: string;

  /**
   * The url of the endpoint
   */
  url: string;
};

export type AddEndpointsRequest = {
  /**
   * The name of the topic.
   * Must be unique and only contain alphanumeric, hyphen, underscore and periods.
   */
  name: string;

  endpoints: Endpoint[];
};

export type RemoveEndpointsRequest = {
  /**
   * The name of the topic.
   * Must be unique and only contain alphanumeric, hyphen, underscore and periods.
   */
  name: string;

  endpoints: (
    | {
        name: string;
        url?: string;
      }
    | {
        name?: string;
        url: string;
      }
  )[];
};

export type Topic = {
  /**
   * The name of this topic.
   */
  name: string;

  /**
   * A list of all subscribed endpoints
   */
  endpoints: Endpoint[];
};

export class Topics {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Create a new topic with the given name and endpoints
   */
  public async addEndpoints(req: AddEndpointsRequest): Promise<Topic> {
    return await this.http.request<Topic>({
      method: "POST",
      path: ["v2", "topics", req.name, "endpoints"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoints: req.endpoints }),
    });
  }

  /**
   * Remove endpoints from a topic.
   */
  public async removeEndpoints(req: RemoveEndpointsRequest): Promise<Topic> {
    return await this.http.request<Topic>({
      method: "DELETE",
      path: ["v2", "topics", req.name, "endpoints"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoints: req.endpoints }),
    });
  }

  /**
   * Get a list of all topics.
   */
  public async list(): Promise<Topic[]> {
    return await this.http.request<Topic[]>({
      method: "GET",
      path: ["v2", "topics"],
    });
  }

  /**
   * Get a single topic
   */
  public async get(name: string): Promise<Topic> {
    return await this.http.request<Topic>({
      method: "GET",
      path: ["v2", "topics", name],
    });
  }

  /**
   * Delete a topic
   */
  public async delete(name: string): Promise<void> {
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v2", "topics", name],
      parseResponseAsJson: false,
    });
  }
}
