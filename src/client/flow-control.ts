import type { Requester } from "./http";

export type FlowControlInfo = {
  /**
   * The flow control key.
   */
  flowControlKey: string;

  /**
   * The number of messages waiting in the wait list.
   */
  waitListSize: number;

  /**
   * The maximum parallelism configured for this flow control key.
   */
  parallelismMax: number;

  /**
   * The current number of active requests for this flow control key.
   */
  parallelismCount: number;

  /**
   * The maximum rate configured for this flow control key.
   */
  rateMax: number;

  /**
   * The current number of requests consumed in the current period.
   */
  rateCount: number;

  /**
   * The rate period in seconds.
   */
  ratePeriod: number;

  /**
   * The start time of the current rate period as a unix timestamp.
   */
  ratePeriodStart: number;
};

export class FlowControlApi {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * List all flow controls.
   *
   * @param options - Optional options.
   * @param options.search - Optional search string to filter flow control keys.
   */
  public async list(options?: { search?: string }): Promise<FlowControlInfo[]> {
    const query: Record<string, string> = {};
    if (options?.search) {
      query.search = options.search;
    }

    return await this.http.request<FlowControlInfo[]>({
      method: "GET",
      path: ["v2", "flowControl"],
      query,
    });
  }

  /**
   * Get a single flow control by key.
   */
  public async get(flowControlKey: string): Promise<FlowControlInfo> {
    return await this.http.request<FlowControlInfo>({
      method: "GET",
      path: ["v2", "flowControl", flowControlKey],
    });
  }

  /**
   * Reset the counters of a flow control key.
   */
  public async reset(flowControlKey: string): Promise<void> {
    return await this.http.request({
      method: "POST",
      path: ["v2", "flowControl", flowControlKey, "reset"],
      parseResponseAsJson: false,
    });
  }
}
