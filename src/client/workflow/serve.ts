/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Client } from "../client";
import { WorkflowContext } from "./context";
import type { WorkflowServeOptions, WorkflowServeParameters } from "./types";
import { parseRequest, validateRequest } from "./workflow-parser";
import {
  handleThirdPartyCallResult,
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
const processOptions = <TResponse = Response, TInitialPayload = unknown>(
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
 * Creates an async method that handles incoming requests and runs the provided
 * route function as a workflow.
 *
 * @param routeFunction - A function that uses WorkflowContext as a parameter and runs a workflow.
 * @param options - Options including the client, onFinish callback, and initialPayloadParser.
 * @returns An async method that consumes incoming requests and runs the workflow.
 */
export const serve = <
  TInitialPayload = unknown,
  TRequest extends Request = Request,
  TResponse = Response,
>({
  routeFunction,
  options,
}: WorkflowServeParameters<TInitialPayload, TResponse>): ((
  request: TRequest
) => Promise<TResponse>) => {
  // Prepares options with defaults if they are not provided.
  const { client, onStepFinish, initialPayloadParser } = processOptions<TResponse, TInitialPayload>(
    options
  );

  /**
   * Handles the incoming request, triggering the appropriate workflow steps.
   * Calls `triggerFirstInvocation()` if it's the first invocation.
   * Otherwise, starts calling `triggerRouteFunction()` to execute steps in the workflow.
   * Finally, calls `triggerWorkflowDelete()` to remove the workflow from QStash.
   *
   * @param request - The incoming request to handle.
   * @returns A promise that resolves to a response.
   */
  return async (request: TRequest) => {
    const callReturnCheck = await handleThirdPartyCallResult(request, client);

    if (callReturnCheck.isErr()) {
      throw callReturnCheck.error;
    } else if (callReturnCheck.value === "continue-workflow") {
      const { isFirstInvocation, workflowId } = validateRequest(request);
      const { initialPayload, steps } = await parseRequest(request, isFirstInvocation);

      const workflowContext = new WorkflowContext<TInitialPayload>({
        client,
        workflowId,
        initialPayload: initialPayloadParser(initialPayload),
        steps,
        url: request.url,
      });

      const result = isFirstInvocation
        ? await triggerFirstInvocation(workflowContext)
        : await triggerRouteFunction({
            onStep: async () => routeFunction(workflowContext),
            onCleanup: async () => triggerWorkflowDelete(workflowContext),
          });

      if (result.isErr()) {
        throw result.error;
      }

      // Returns a Response with `workflowId` at the end of each step.
      return onStepFinish(workflowContext.workflowId);
    }

    // response to QStash in call cases
    return onStepFinish("no-workflow-id");
  };
};
