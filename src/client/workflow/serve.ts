/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Client } from "../client";
import { WorkflowContext } from "./context";
import type { WorkflowServeOptions, WorkflowServeParameters } from "./types";
import { Workflow } from "./workflow";

const processOptions = (options?: WorkflowServeOptions) => {
  return {
    client:
      options?.client ??
      new Client({
        baseUrl: process.env.QSTASH_URL!,
        token: process.env.QSTASH_TOKEN!,
      }),
    onFinish:
      options?.onFinish ??
      ((workflowId: string) => new Response(JSON.stringify({ workflowId }), { status: 200 })),
  };
};

export const serve = <TPayload>({
  routeFunction,
  options,
}: WorkflowServeParameters<TPayload>): ((request: Request) => Promise<Response>) => {
  // TODO add receiver for verification

  const { client, onFinish } = processOptions(options);

  return async (request: Request) => {
    const workflow = await Workflow.createWorkflow<TPayload>(request, client);
    const workflowContext = new WorkflowContext({ workflow });
    await routeFunction(workflowContext);
    return onFinish(workflow.workflowId);
  };
};
