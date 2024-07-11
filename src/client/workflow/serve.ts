/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Client } from "../client";
import { QstashWorkflowAbort } from "../error";
import { WorkflowContext } from "./context";
import type { WorkflowServeOptions, WorkflowServeParameters } from "./types";

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
    onFinish:
      options?.onFinish ??
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
  // TODO add receiver for verification

  const { client, onFinish, initialPayloadParser } = processOptions<TResponse, TInitialPayload>(
    options
  );

  return async (request: TRequest) => {
    const { workflowContext, isFirstInvocation } =
      await WorkflowContext.createContext<TInitialPayload>(request, client, initialPayloadParser);

    try {
      await (isFirstInvocation
        ? // if we are running for the first time, simply call publishJSON and send the payload to QStash
          workflowContext.client.publishJSON({
            headers: workflowContext.getHeaders("true"),
            method: "POST",
            body: workflowContext.requestPayload,
            url: workflowContext.url,
          })
        : // if we are not running for the first time, call the route function with the context
          routeFunction(workflowContext));
    } catch (error) {
      // if QstashWorkflowAbort occurs, a step has executed successfully and the call can return
      if (!(error instanceof QstashWorkflowAbort)) {
        throw error;
      }
    }
    return onFinish(workflowContext.workflowId);
  };
};
