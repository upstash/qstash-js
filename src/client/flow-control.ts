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

  /**
   * Whether message delivery is paused for this flow control key.
   */
  isPaused: boolean;

  /**
   * Whether the parallelism configuration is pinned.
   */
  isPinnedParallelism: boolean;

  /**
   * Whether the rate configuration is pinned.
   */
  isPinnedRate: boolean;
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

export type PinFlowControlOptions = {
  /**
   * The parallelism value to apply to the flow-control key.
   */
  parallelism?: number;

  /**
   * The rate value to apply to the flow-control key.
   */
  rate?: number;

  /**
   * The period value to apply to the flow-control key, in seconds.
   */
  period?: number;
};

export type UnpinFlowControlOptions = {
  /**
   * Whether to unpin the parallelism configuration.
   */
  parallelism?: boolean;

  /**
   * Whether to unpin the rate configuration.
   */
  rate?: boolean;
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

  /**
   * Pause message delivery for a flow-control key.
   *
   * Messages already in the waitlist will remain there.
   * New incoming messages will be added directly to the waitlist.
   */
  public async pause(flowControlKey: string): Promise<void> {
    await this.http.request({
      method: "POST",
      path: ["v2", "flowControl", flowControlKey, "pause"],
      parseResponseAsJson: false,
    });
  }

  /**
   * Resume message delivery for a flow-control key.
   */
  public async resume(flowControlKey: string): Promise<void> {
    await this.http.request({
      method: "POST",
      path: ["v2", "flowControl", flowControlKey, "resume"],
      parseResponseAsJson: false,
    });
  }

  /**
   * Pin a processing configuration for a flow-control key.
   *
   * While pinned, the system ignores configurations provided by incoming
   * messages and uses the pinned configuration instead.
   */
  public async pin(flowControlKey: string, options: PinFlowControlOptions): Promise<void> {
    await this.http.request({
      method: "POST",
      path: ["v2", "flowControl", flowControlKey, "pin"],
      query: {
        parallelism: options.parallelism,
        rate: options.rate,
        period: options.period,
      },
      parseResponseAsJson: false,
    });
  }

  /**
   * Remove the pinned configuration for a flow-control key.
   *
   * After unpinning, the system resumes updating the configuration
   * based on incoming messages.
   */
  public async unpin(flowControlKey: string, options: UnpinFlowControlOptions): Promise<void> {
    await this.http.request({
      method: "POST",
      path: ["v2", "flowControl", flowControlKey, "unpin"],
      query: {
        parallelism: options.parallelism,
        rate: options.rate,
      },
      parseResponseAsJson: false,
    });
  }

  /**
   * Reset the rate configuration state for a flow-control key.
   *
   * Clears the current rate count and immediately ends the current period.
   * The current timestamp becomes the start of the new rate period.
   */
  public async resetRate(flowControlKey: string): Promise<void> {
    await this.http.request({
      method: "POST",
      path: ["v2", "flowControl", flowControlKey, "resetRate"],
      parseResponseAsJson: false,
    });
  }
}
