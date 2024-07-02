import type { Client } from "../client";
import { Workflow } from "./workflow";

/**
 *
 */
export const serve = <TPayload>({
  client,
  routeFunction,
  onFinish,
}: {
  client: Client;
  routeFunction: (context: Workflow<TPayload>) => Promise<void>;
  onFinish: (workflowId: string) => unknown;
}) => {
  return async (request: Request) => {
    const workflow = await Workflow.createWorkflow<TPayload>(request, client);
    await routeFunction(workflow);
    // return new Response(JSON.stringify({ workflowId: workflow.workflowId }), { status: 200 });
    return onFinish(workflow.workflowId);
  };
};
