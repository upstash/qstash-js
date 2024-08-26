/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Receiver } from "../../receiver";
import { Client } from "../client";
import { formatWorkflowError } from "../error";
import { DisabledWorkflowContext, WorkflowContext } from "./context";
import { WorkflowLogger } from "./logger";
import type {
  FinishCondition,
  RequiredExceptFields,
  RouteFunction,
  WorkflowServeOptions,
} from "./types";
import { getPayload, handleFailure, parseRequest, validateRequest } from "./workflow-parser";
import {
  handleThirdPartyCallResult,
  recreateUserHeaders,
  triggerFirstInvocation,
  triggerRouteFunction,
  triggerWorkflowDelete,
  verifyRequest,
} from "./workflow-requests";

/**
 * Fills the options with default values if they are not provided.
 *
 * Default values for:
 * - qstashClient: QStash client created with QSTASH_URL and QSTASH_TOKEN env vars
 * - onStepFinish: returns a Response with workflowRunId & finish condition in the body (status: 200)
 * - initialPayloadParser: calls JSON.parse if initial request body exists.
 * - receiver: a Receiver if the required env vars are set
 * - baseUrl: env variable UPSTASH_WORKFLOW_URL
 *
 * @param options options including the client, onFinish and initialPayloadParser
 * @returns
 */
export const processOptions = <TResponse extends Response = Response, TInitialPayload = unknown>(
  options?: WorkflowServeOptions<TResponse, TInitialPayload>
): RequiredExceptFields<
  WorkflowServeOptions<TResponse, TInitialPayload>,
  "verbose" | "receiver" | "url" | "failureFunction" | "failureUrl" | "baseUrl"
> => {
  const environment =
    options?.env ?? (typeof process === "undefined" ? ({} as Record<string, string>) : process.env);

  const receiverEnvironmentVariablesSet = Boolean(
    environment.QSTASH_CURRENT_SIGNING_KEY && environment.QSTASH_NEXT_SIGNING_KEY
  );

  return {
    qstashClient: new Client({
      baseUrl: environment.QSTASH_URL!,
      token: environment.QSTASH_TOKEN!,
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
    receiver: receiverEnvironmentVariablesSet
      ? new Receiver({
          currentSigningKey: environment.QSTASH_CURRENT_SIGNING_KEY!,
          nextSigningKey: environment.QSTASH_NEXT_SIGNING_KEY!,
        })
      : undefined,
    baseUrl: environment.UPSTASH_WORKFLOW_URL,
    env: environment,
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
>(
  routeFunction: RouteFunction<TInitialPayload>,
  options?: WorkflowServeOptions<TResponse, TInitialPayload>
): ((request: TRequest) => Promise<TResponse>) => {
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
    baseUrl,
    env,
  } = processOptions<TResponse, TInitialPayload>(options);

  const debug = WorkflowLogger.getLogger(verbose);

  /**
   * Handles the incoming request, triggering the appropriate workflow steps.
   * Calls `triggerFirstInvocation()` if it's the first invocation.
   * Otherwise, starts calling `triggerRouteFunction()` to execute steps in the workflow.
   * Finally, calls `triggerWorkflowDelete()` to remove the workflow from QStash.
   *
   * @param request - The incoming request to handle.
   * @returns A promise that resolves to a response.
   */
  const handler = async (request: TRequest) => {
    // set the workflow endpoint url. If baseUrl is set and initialWorkflowUrl
    // has localhost, replaces localhost with baseUrl
    const initialWorkflowUrl = url ?? request.url;
    const workflowUrl = baseUrl
      ? initialWorkflowUrl.replace(/^(https?:\/\/[^/]+)(\/.*)?$/, (_, matchedBaseUrl, path) => {
          return baseUrl + ((path as string) || "");
        })
      : initialWorkflowUrl;

    // log workflow url change
    if (workflowUrl !== initialWorkflowUrl) {
      await debug?.log("WARN", "ENDPOINT_START", {
        warning: `QStash Workflow: replacing the base of the url with "${baseUrl}" and using it as workflow endpoint.`,
        originalURL: initialWorkflowUrl,
        updatedURL: workflowUrl,
      });
    }

    // set url to call in case of failure
    const workflowFailureUrl = failureFunction ? workflowUrl : failureUrl;

    // get payload as raw string
    const requestPayload = (await getPayload(request)) ?? "";
    await verifyRequest(requestPayload, request.headers.get("upstash-signature"), receiver);

    await debug?.log("INFO", "ENDPOINT_START");

    // check if the request is a failure callback
    const failureCheck = await handleFailure<TInitialPayload>(
      request,
      requestPayload,
      qstashClient,
      initialPayloadParser,
      failureFunction
    );
    if (failureCheck.isErr()) {
      // unexpected error during handleFailure
      throw failureCheck.error;
    } else if (failureCheck.value === "is-failure-callback") {
      // is a failure ballback.
      await debug?.log("WARN", "RESPONSE_DEFAULT", "failureFunction executed");
      return onStepFinish("no-workflow-id", "failure-callback");
    }

    // validation & parsing
    const { isFirstInvocation, workflowRunId } = validateRequest(request);
    debug?.setWorkflowRunId(workflowRunId);

    // parse steps
    const { rawInitialPayload, steps, isLastDuplicate } = await parseRequest(
      requestPayload,
      isFirstInvocation,
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
      env,
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
      await debug?.log("INFO", "RESPONSE_WORKFLOW");
      return onStepFinish(workflowContext.workflowRunId, "success");
    }
    // response to QStash in call cases
    await debug?.log("INFO", "RESPONSE_DEFAULT");
    return onStepFinish("no-workflow-id", "fromCallback");
  };

  return async (request: TRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify(formatWorkflowError(error)), { status: 500 }) as TResponse;
    }
  };
};
