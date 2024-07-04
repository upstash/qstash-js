/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Client } from "../client";
import { QstashWorkflowAbort } from "../error";
import { WorkflowContext } from "./context";
import type { WorkflowServeOptions, WorkflowServeParameters } from "./types";
import { Workflow } from "./workflow";

/**
 * Fills the options with default values if they are not provided.
 *
 * @param options options including the client and the onFinish
 * @returns
 */
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

/**
 * Creates an async method which handles incoming requests and runs the provided
 * route function as a workflow.
 *
 * @param routefunction function using WorklfowContext as parameter and running a workflow
 * @param options options including the client and the onFinish
 * @returns an async method consuming incoming requests and running the workflow
 */
export const serve = <
  TInitialRequest = unknown,
  TRequest extends Request = Request,
  TResponse extends Response = Response,
>({
  routeFunction,
  options,
}: WorkflowServeParameters<TInitialRequest, TResponse>): ((
  request: TRequest
) => Promise<TResponse>) => {
  // TODO add receiver for verification

  const { client, onFinish } = processOptions<TResponse>(options);

  return async (request: TRequest) => {
    const { workflow, isFirstInvocation } = await Workflow.createWorkflow(request, client);

    if (isFirstInvocation) {
      await workflow.submitResults(workflow.steps[0]);
    } else {
      const workflowContext = new WorkflowContext<TInitialRequest>({
        workflow,
        requestPayload: workflow.steps[0].out as TInitialRequest,
      });
      try {
        await routeFunction(workflowContext);
      } catch (error) {
        if (!(error instanceof QstashWorkflowAbort)) {
          throw error;
        }
      }
    }
    return onFinish(workflow.workflowId);
  };
};
