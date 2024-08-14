/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Receiver } from "../../receiver";
import { Client } from "../client";
import { DisabledWorkflowContext, WorkflowContext } from "./context";
import { WorkflowLogger } from "./logger";
import type { FinishCondition, WorkflowServeOptions, WorkflowServeParameters } from "./types";
import { handleFailure, parseRequest, validateRequest } from "./workflow-parser";
import {
  handleThirdPartyCallResult,
  recreateUserHeaders,
  triggerFirstInvocation,
  triggerRouteFunction,
  triggerWorkflowDelete,
} from "./workflow-requests";

/**
 * Fills the options with default values if they are not provided.
 *
 * Default values for:
 * - qstashClient: QStash client created with QSTASH_URL and QSTASH_TOKEN env vars
 * - onFinish: returns a Response with workflowRunId in the body and status: 200
 * - initialPayloadParser: calls JSON.parse if initial request body exists.
 *
 * @param options options including the client, onFinish and initialPayloadParser
 * @returns
 */
const processOptions = <TResponse extends Response = Response, TInitialPayload = unknown>(
  options?: WorkflowServeOptions<TResponse, TInitialPayload>
): Required<WorkflowServeOptions<TResponse, TInitialPayload>> => {
  const receiverEnvironmentVariablesSet = Boolean(
    process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
  );

  return {
    qstashClient: new Client({
      baseUrl: process.env.QSTASH_URL!,
      token: process.env.QSTASH_TOKEN!,
    }),
    onStepFinish: (workflowRunId: string, finishCondition: FinishCondition) =>
      new Response(JSON.stringify({ workflowRunId, finishCondition }), {
        status: 200,
      }) as TResponse,
    initialPayloadParser: (initialRequest: string) => {
      // if there is no payload, simply return undefined
      if (!initialRequest) {
        return undefined as TInitialPayload;
      }

      // try to parse the payload
      try {
        return JSON.parse(initialRequest) as TInitialPayload;
      } catch (error) {
        // if you get an error when parsing, return it as it is
        // needed in plain string case.
        if (error instanceof SyntaxError) {
          return initialRequest as TInitialPayload;
        }
        // if not JSON.parse error, throw error
        throw error;
      }
    },
    url: "", // will be overwritten with request.url
    verbose: false,
    // initialize a receiver if the env variables are set:
    receiver:
      receiverEnvironmentVariablesSet &&
      new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
      }),
    failureUrl: false,
    failureFunction: false,
    ...options,
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
  TResponse extends Response = Response,
>({
  routeFunction,
  options,
}: WorkflowServeParameters<TInitialPayload, TResponse>): ((
  request: TRequest
) => Promise<TResponse>) => {
  // Prepares options with defaults if they are not provided.
  const {
    qstashClient,
    onStepFinish,
    initialPayloadParser,
    url,
    verbose,
    receiver,
    failureUrl,
    failureFunction,
  } = processOptions<TResponse, TInitialPayload>(options);

  const debug = WorkflowLogger.getLogger(verbose);
  const verifier = receiver || undefined;

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
    const workflowUrl = url || request.url;
    const workflowFailureUrl = failureFunction ? workflowUrl : failureUrl;

    await debug?.log("INFO", "ENDPOINT_START");

    // check if the request is a failure callback
    const failureCheck = await handleFailure(request, failureFunction);
    if (failureCheck.isErr()) {
      // unexpected error during handleFailure
      throw failureCheck.error;
    } else if (failureCheck.value === "is-failure-callback") {
      // is a failure ballback.
      return onStepFinish("no-workflow-id", "failure-callback");
    }

    // validation & parsing
    const { isFirstInvocation, workflowRunId } = validateRequest(request);
    const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
      request,
      isFirstInvocation,
      verifier,
      debug
    );

    // terminate current call if it's a duplicate branch
    if (isLastDuplicate) {
      return onStepFinish("no-workflow-id", "duplicate-step");
    }

    // create context
    const workflowContext = new WorkflowContext<TInitialPayload>({
      qstashClient,
      workflowRunId,
      initialPayload: initialPayloadParser(rawInitialPayload),
      rawInitialPayload,
      headers: recreateUserHeaders(request.headers as Headers),
      steps,
      url: workflowUrl,
      failureUrl: workflowFailureUrl,
      debug,
    });

    // attempt running routeFunction until the first step
    const authCheck = await DisabledWorkflowContext.tryAuthentication(
      routeFunction,
      workflowContext
    );
    if (authCheck.isErr()) {
      // got error while running until first step
      await debug?.log("ERROR", "ERROR", { error: authCheck.error.message });
      throw authCheck.error;
    } else if (authCheck.value === "run-ended") {
      // finished routeFunction while trying to run until first step.
      // either there is no step or auth check resulted in `return`
      return onStepFinish("no-workflow-id", "auth-fail");
    }

    // check if request is a third party call result
    const callReturnCheck = await handleThirdPartyCallResult(
      request,
      rawInitialPayload,
      qstashClient,
      workflowUrl,
      workflowFailureUrl,
      debug
    );
    if (callReturnCheck.isErr()) {
      // error while checking
      await debug?.log("ERROR", "SUBMIT_THIRD_PARTY_RESULT", {
        error: callReturnCheck.error.message,
      });
      throw callReturnCheck.error;
    } else if (callReturnCheck.value === "continue-workflow") {
      // request is not third party call. Continue workflow as usual
      const result = isFirstInvocation
        ? await triggerFirstInvocation(workflowContext, debug)
        : await triggerRouteFunction({
            onStep: async () => routeFunction(workflowContext),
            onCleanup: async () => {
              await triggerWorkflowDelete(workflowContext, debug);
            },
          });

      if (result.isErr()) {
        // error while running the workflow or when cleaning up
        await debug?.log("ERROR", "ERROR", { error: result.error.message });
        throw result.error;
      }

      // Returns a Response with `workflowRunId` at the end of each step.
      await debug?.log("INFO", "RESPONSE_WORKFLOW", {
        workflowRunId: workflowContext.workflowRunId,
      });
      return onStepFinish(workflowContext.workflowRunId, "success");
    }
    // response to QStash in call cases
    await debug?.log("INFO", "RESPONSE_DEFAULT");
    return onStepFinish("no-workflow-id", "fromCallback");
  };
};
