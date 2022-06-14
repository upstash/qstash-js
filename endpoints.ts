import { Requester } from "./http.ts";

export type CreateEndpointRequest = {
  /**
   * The url of the endpoint.
   */
  url: string;

  /**
   * The name of the topic to subscribe to.
   */
  topicName: string;
};

export type GetEndpointRequest = {
  id: string;
};
export type UpdateEndpointRequest = {
  id: string;
  url?: string;
};
export type DeleteEndpointRequest = { id: string };
export type Endpoint = {
  /**
   * ID for this endpoint
   */
  id: string;

  /**
   * The url of this endpoint.
   */
  url: string;

  /**
   * The topic id this endpoint is subscribed to.
   */
  topicID: string;
};

export class Endpoints {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Create a new endpoint with the given name.
   */
  public async create(req: CreateEndpointRequest): Promise<Endpoint> {
    return await this.http.request<Endpoint>({
      method: "POST",
      path: ["v1", "endpoints"],
      body: JSON.stringify(req),
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get a list of all endpoints.
   */
  public async list(): Promise<Endpoint[]> {
    return await this.http.request<Endpoint[]>({
      method: "GET",
      path: ["v1", "endpoints"],
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get a single endpoint.
   */
  public async get(req: GetEndpointRequest): Promise<Endpoint> {
    return await this.http.request<Endpoint>({
      method: "GET",
      path: ["v1", "endpoints", req.id],
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Update a endpoint
   */
  public async update(req: UpdateEndpointRequest): Promise<Endpoint> {
    return await this.http.request<Endpoint>({
      method: "PUT",
      path: ["v1", "endpoints", req.id],
      body: JSON.stringify({ url: req.url }),
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Delete a endpoint.
   */
  public async delete(req: DeleteEndpointRequest): Promise<void> {
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v1", "endpoints", req.id],
      headers: { "Content-Type": "application/json" },
    });
  }
}
