/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Client } from "../client";
import { WorkflowContext } from "./context";
import type { WorkflowServeOptions, WorkflowServeParameters } from "./types";
import {
  triggerFirstInvocation,
  triggerRouteFunction,
  triggerWorkflowDelete,
} from "./workflow-requests";

/**
 * Fills the options with default values if they are not provided.
 *
 * Default values for:
 * - client: QStash client created with QSTASH_URL and QSTASH_TOKEN env vars
 * - onFinish: returns a Response with workflowId in the body and status: 200
 * - initialPayloadParser: calls JSON.parse if initial request body exists.
 *
 * @param options options including the client, onFinish and initialPayloadParser
 * @returns
 */
const processOptions = <TResponse extends Response = Response, TInitialPayload = unknown>(
  options?: WorkflowServeOptions<TResponse, TInitialPayload>
): Required<WorkflowServeOptions<TResponse, TInitialPayload>> => {
  return {
    client:
      options?.client ??
      new Client({
        baseUrl: process.env.QSTASH_URL!,
        token: process.env.QSTASH_TOKEN!,
      }),
    onStepFinish:
      options?.onStepFinish ??
      ((workflowId: string) =>
        new Response(JSON.stringify({ workflowId }), { status: 200 }) as TResponse),
    initialPayloadParser:
      options?.initialPayloadParser ??
      ((initialRequest: string) => {
        return (initialRequest ? JSON.parse(initialRequest) : undefined) as TInitialPayload;
      }),
  };
};

/**
 * Creates an async method which handles incoming requests and runs the provided
 * route function as a workflow.
 *
 * @param routefunction function using WorklfowContext as parameter and running a workflow
 * @param options options including client, onFinish and initialPayloadParser
 * @returns an async method consuming incoming requests and running the workflow
 */
export const serve = <
  TInitialPayload = unknown,
  TRequest extends Request = Request,
  TResponse extends Response = Response,
>({
  routeFunction,
  options,
}: WorkflowServeParameters<TInitialPayload, TResponse>): ((
  request: TRequest
) => Promise<TResponse>) => {
  const { client, onStepFinish, initialPayloadParser } = processOptions<TResponse, TInitialPayload>(
    options
  );

  return async (request: TRequest) => {
    const { workflowContext, isFirstInvocation } =
      await WorkflowContext.createContext<TInitialPayload>(request, client, initialPayloadParser);

    const result = isFirstInvocation
      ? await triggerFirstInvocation(workflowContext)
      : await triggerRouteFunction(
          async () => routeFunction(workflowContext),
          async () => triggerWorkflowDelete(workflowContext)
        );

    if (result.isErr()) {
      throw result.error;
    }

    return onStepFinish(workflowContext.workflowId);
  };
};
