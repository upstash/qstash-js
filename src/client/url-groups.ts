import type { Requester } from "./http";

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
   * The name of the url group.
   * Must be unique and only contain alphanumeric, hyphen, underscore and periods.
   */
  name: string;

  endpoints: Endpoint[];
};

export type RemoveEndpointsRequest = {
  /**
   * The name of the url group.
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

export type UrlGroup = {
  /**
   * A unix timestamp (milliseconds)
   */
  createdAt: number;
  /**
   * A unix timestamp (milliseconds)
   */
  updatedAt: number;
  /**
   * The name of this url group.
   */
  name: string;

  /**
   * A list of all subscribed endpoints
   */
  endpoints: Endpoint[];
};

export class UrlGroups {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Create a new url group with the given name and endpoints
   */
  public async addEndpoints(request: AddEndpointsRequest): Promise<void> {
    await this.http.request<UrlGroup>({
      method: "POST",
      path: ["v2", "topics", request.name, "endpoints"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoints: request.endpoints }),
      parseResponseAsJson: false,
    });
  }

  /**
   * Remove endpoints from a url group.
   */
  public async removeEndpoints(request: RemoveEndpointsRequest): Promise<void> {
    await this.http.request<UrlGroup>({
      method: "DELETE",
      path: ["v2", "topics", request.name, "endpoints"],
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoints: request.endpoints }),
      parseResponseAsJson: false,
    });
  }

  /**
   * Get a list of all url groups.
   */
  public async list(): Promise<UrlGroup[]> {
    return await this.http.request<UrlGroup[]>({
      method: "GET",
      path: ["v2", "topics"],
    });
  }

  /**
   * Get a single url group
   */
  public async get(name: string): Promise<UrlGroup> {
    return await this.http.request<UrlGroup>({
      method: "GET",
      path: ["v2", "topics", name],
    });
  }

  /**
   * Delete a url group
   */
  public async delete(name: string): Promise<void> {
    return await this.http.request({
      method: "DELETE",
      path: ["v2", "topics", name],
      parseResponseAsJson: false,
    });
  }
}
