import type { Requester } from "../http";

export * from "./serve";
export * from "./context";
export * from "./types";
export * from "./logger";

/**
 * @deprecated as of version 2.7.17. Will be removed in qstash-js 3.0.0.
 * Please use https://github.com/upstash/workflow-js
 * Migration Guide: https://upstash.com/docs/workflow/migration
 */
export class Workflow {
  private readonly http;

  constructor(http: Requester) {
    this.http = http;
  }

  /**
   * Cancel an ongoing workflow
   *
   * @param workflowRunId run id of the workflow to delete
   * @returns true if workflow is succesfully deleted. Otherwise throws QStashError
   */
  public async cancel(workflowRunId: string) {
    const result = (await this.http.request({
      path: ["v2", "workflows", "runs", `${workflowRunId}?cancel=true`],
      method: "DELETE",
      parseResponseAsJson: false,
    })) as { error: string } | undefined;
    return result ?? true;
  }
}
