/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Client } from "../client";
import { WorkflowContext } from "./context";
import type { WorkflowServeOptions, WorkflowServeParameters } from "./types";
import { Workflow } from "./workflow";

const processOptions = <TResponse extends Response = Response>(
  options?: WorkflowServeOptions<TResponse>
) => {
  return {
    client:
      options?.client ??
      new Client({
        baseUrl: process.env.QSTASH_URL!,
        token: process.env.QSTASH_TOKEN!,
      }),
    onFinish:
      options?.onFinish ??
      ((workflowId: string) =>
        new Response(JSON.stringify({ workflowId }), { status: 200 }) as TResponse),
  };
};

export const serve = <
  TPayload,
  TRequest extends Request = Request,
  TResponse extends Response = Response,
>({
  routeFunction,
  options,
}: WorkflowServeParameters<TPayload, TResponse>): ((request: TRequest) => Promise<TResponse>) => {
  // TODO add receiver for verification

  const { client, onFinish } = processOptions<TResponse>(options);

  return async (request: TRequest) => {
    const workflow = await Workflow.createWorkflow<TPayload>(request, client);
    const workflowContext = new WorkflowContext({ workflow });
    await routeFunction(workflowContext);
    return onFinish(workflow.workflowId);
  };
};
