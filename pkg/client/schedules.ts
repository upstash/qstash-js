import { Requester } from "./http.ts";
import type { Log, Task } from "./types.ts";

export type GetScheduleRequest = {
  id: string;
};
export type DeleteScheduleRequest = {
  id: string;
};
export type Schedule = {
  scheduleId: string;
  cron: string;
  createdAt: number;
  content: {
    header?: Record<string, string[]> | null;
    body?: string | null;
  };
  destination: {
    type: "topic";
    url?: never;
    topic: {
      topicId: string;
      name: string;
      endpoints: {
        endpointId: string;
        url: string;
        topicId: string;
      }[];
    };
  } | {
    type: "url";
    topic?: never;
    url: string;
  };
  settings: {
    notBefore?: number;
    retries?: number;
  };
};

export type ListLogsRequest = {
  // Schedule id
  id: string;
  cursor?: number;
};

export type ListLogsResponse = {
  cursor?: number;
  logs: Log[];
};

export type ListTasksRequest = {
  // Schedule id
  id: string;
  cursor?: number;
};

export type ListTasksResponse = {
  cursor?: number;
  logs: Task[];
};

export class Schedules {
  private readonly http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Get a schedule
   */
  public async get(req: GetScheduleRequest): Promise<Schedule> {
    return await this.http.request<Schedule>({
      method: "GET",
      path: ["v1", "schedules", req.id],
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * List your schedules
   */
  public async list(): Promise<Schedule[]> {
    return await this.http.request<Schedule[]>({
      method: "GET",
      path: ["v1", "schedules"],
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Delete a schedule
   */
  public async delete(req: DeleteScheduleRequest): Promise<void> {
    return await this.http.request<void>({
      method: "DELETE",
      path: ["v1", "schedules", req.id],
      headers: { "Content-Type": "application/json" },
    });
  }
}
