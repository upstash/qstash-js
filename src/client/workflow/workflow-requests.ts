import type { Err, Ok } from "neverthrow";
import { err, fromSafePromise, ok } from "neverthrow";
import { QstashWorkflowAbort, QstashWorkflowError } from "../error";
import type { WorkflowContext } from "./context";
import type { Client } from "../client";
import {
  DEFAULT_CONTENT_TYPE,
  WORKFLOW_ID_HEADER,
  WORKFLOW_INIT_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
  WORKFLOW_URL_HEADER,
} from "./constants";
import type { Step, StepType } from "./types";
import { StepTypes } from "./types";

export const triggerFirstInvocation = <TInitialPayload>(
  workflowContext: WorkflowContext<TInitialPayload>
) => {
  return fromSafePromise(
    workflowContext.client.publishJSON({
      headers: getHeaders(
        "true",
        workflowContext.workflowId,
        workflowContext.url,
        workflowContext.headers
      ),
      method: "POST",
      body: workflowContext.requestPayload,
      url: workflowContext.url,
    })
  );
};

export const triggerRouteFunction = async ({
  onCleanup,
  onStep,
}: {
  onStep: () => Promise<void>;
  onCleanup: () => Promise<void>;
}): Promise<Ok<"workflow-finished" | "step-finished", never> | Err<never, Error>> => {
  try {
    // When onStep completes successfully, it throws an exception named `QstashWorkflowAbort`, indicating that the step has been successfully executed.
    // This ensures that onCleanup is only called when no exception is thrown.
    await onStep();
    await onCleanup();
    return ok("workflow-finished");
  } catch (error) {
    const error_ = error as Error;
    return error_ instanceof QstashWorkflowAbort ? ok("step-finished") : err(error_);
  }
};

export const triggerWorkflowDelete = async <TInitialPayload>(
  workflowContext: WorkflowContext<TInitialPayload>,
  cancel = false
) => {
  await workflowContext.client.http.request({
    path: ["v2", "workflows", `${workflowContext.workflowId}?cancel=${cancel}`],
    method: "DELETE",
    parseResponseAsJson: false,
  });
};

/**
 * Removes headers starting with `Upstash-Workflow-` from the headers
 *
 * @param headers incoming headers
 * @returns headers with `Upstash-Workflow-` headers removed
 */
export const recreateUserHeaders = (headers: Headers): Headers => {
  const filteredHeaders = new Headers();

  const pairs = headers.entries() as unknown as [string, string][];
  for (const [header, value] of pairs) {
    if (!header.toLowerCase().startsWith("upstash-workflow-")) {
      filteredHeaders.append(header, value);
    }
  }

  return filteredHeaders as Headers;
};

/**
 * Checks if the request is from a third party call result. If so,
 * calls qstash to add the result to the ongoing workflow.
 *
 * Otherwise, does nothing.
 *
 * ### How third party calls work
 *
 * In third party calls, we publish a message to the third party API.
 * the result is then returned back to the workflow endpoint.
 *
 * Whenever the workflow endpoint receives a request, we first check
 * if the incoming request is a third party call result coming from QStash.
 * If so, we send back the result to QStash as a result step.
 *
 * @param request Incoming request
 * @param client qstash client
 * @returns
 */
export const handleThirdPartyCallResult = async (
  request: Request,
  client: Client
): Promise<
  Ok<"is-call-return" | "continue-workflow" | "call-will-retry", never> | Err<never, Error>
> => {
  try {
    if (request.headers.get("Upstash-Workflow-Callback")) {
      const callbackMessage = (await request.json()) as {
        status: number;
        body: string;
      };

      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      if (!(callbackMessage.status >= 200 && callbackMessage.status < 300)) {
        // this callback will be retried by the qstash, we just ignore it
        return ok("call-will-retry");
      }

      const workflowId = request.headers.get(WORKFLOW_ID_HEADER);
      const stepIdString = request.headers.get("Upstash-Workflow-StepId");
      const stepName = request.headers.get("Upstash-Workflow-StepName");
      const stepType = request.headers.get("Upstash-Workflow-StepType") as StepType;
      const concurrentString = request.headers.get("Upstash-Workflow-Concurrent");
      const contentType = request.headers.get("Upstash-Workflow-ContentType");

      if (
        !(
          workflowId &&
          stepIdString &&
          stepName &&
          StepTypes.includes(stepType) &&
          concurrentString &&
          contentType
        )
      ) {
        throw new Error(
          `Missing info in callback message source header: ${[
            workflowId,
            stepIdString,
            stepName,
            stepType,
            concurrentString,
            contentType,
          ]}`
        );
      }

      request.headers.append("Content-Type", contentType);
      request.headers.append(WORKFLOW_INIT_HEADER, "false");
      request.headers.append(
        `Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`,
        WORKFLOW_PROTOCOL_VERSION
      );
      const userHeaders = recreateUserHeaders(request.headers as Headers);

      const callResultStep: Step = {
        stepId: Number(stepIdString),
        stepName,
        stepType,
        out: Buffer.from(callbackMessage.body, "base64").toString(),
        concurrent: Number(concurrentString),
        targetStep: 0,
      };

      await client.publishJSON({
        headers: userHeaders,
        method: "POST",
        body: callResultStep,
        url: request.url,
      });

      return ok("is-call-return");
    } else {
      return ok("continue-workflow");
    }
  } catch (error) {
    const isCallReturn = request.headers.get("Upstash-Workflow-Callback");
    return err(
      new QstashWorkflowError(
        `Error when handling call return (isCallReturn=${isCallReturn}): ${error}`
      )
    );
  }
};

/**
 * Gets headers for calling QStash
 *
 * @param initHeaderValue Whether the invocation should create a new workflow
 * @param workflowId id of the workflow
 * @param workflowUrl url of the workflow endpoint
 * @param step step to get headers for. If the step is a third party call step, more
 *       headers are added.
 * @returns headers to submit
 */
export const getHeaders = (
  initHeaderValue: "true" | "false",
  workflowId: string,
  workflowUrl: string,
  userHeaders?: Headers,
  step?: Step
): Record<string, string> => {
  const baseHeaders: Record<string, string> = {
    [WORKFLOW_INIT_HEADER]: initHeaderValue,
    [WORKFLOW_ID_HEADER]: workflowId,
    [WORKFLOW_URL_HEADER]: workflowUrl,
    [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
  };

  if (userHeaders) {
    for (const header of userHeaders.keys()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      baseHeaders[`Upstash-Forward-${header}`] = userHeaders.get(header)!;
    }
  }

  if (step?.callUrl) {
    const forwardedHeaders = Object.fromEntries(
      Object.entries(step.callHeaders).map(([header, value]) => [
        `Upstash-Forward-${header}`,
        value,
      ])
    );

    const contentType = step.callHeaders["Content-Type"] as string | undefined;

    return {
      ...baseHeaders,
      ...forwardedHeaders,
      "Upstash-Callback": workflowUrl,
      "Upstash-Callback-Workflow-Id": workflowId,
      "Upstash-Callback-Workflow-CallType": "fromCallback",
      "Upstash-Callback-Workflow-Init": "false",

      "Upstash-Callback-Forward-Upstash-Workflow-Callback": "true",
      "Upstash-Callback-Forward-Upstash-Workflow-StepId": step.stepId.toString(),
      "Upstash-Callback-Forward-Upstash-Workflow-StepName": step.stepName,
      "Upstash-Callback-Forward-Upstash-Workflow-StepType": step.stepType,
      "Upstash-Callback-Forward-Upstash-Workflow-Concurrent": step.concurrent.toString(),
      "Upstash-Callback-Forward-Upstash-Workflow-ContentType": contentType ?? DEFAULT_CONTENT_TYPE,
      "Upstash-Workflow-CallType": "toCallback",
    };
  }

  return baseHeaders;
};
