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

export type GlobalParallelismInfo = {
  /**
   * The maximum global parallelism.
   */
  parallelismMax: number;

  /**
   * The current number of active requests globally.
   */
  parallelismCount: number;
};

export class FlowControlApi {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
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
   * Get the global parallelism info.
   */
  public async getGlobalParallelism(): Promise<GlobalParallelismInfo> {
    const response = await this.http.request<Partial<GlobalParallelismInfo>>({
      method: "GET",
      path: ["v2", "globalParallelism"],
    });

    return {
      parallelismMax: response.parallelismMax ?? 0,
      parallelismCount: response.parallelismCount ?? 0,
    };
  }
}
