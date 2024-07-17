import type { Err, Ok } from "neverthrow";
import { err, fromSafePromise, ok } from "neverthrow";
import { QstashWorkflowAbort } from "../error";
import type { WorkflowContext } from "./context";

export const triggerFirstInvocation = <TInitialPayload>(
  workflowContext: WorkflowContext<TInitialPayload>
) => {
  return fromSafePromise(
    workflowContext.client.publishJSON({
      headers: workflowContext.getHeaders("true"),
      method: "POST",
      body: workflowContext.requestPayload,
      url: workflowContext.url,
    })
  );
};

export const triggerRouteFunction = async (
  routeFunction: () => Promise<void>,
  onCleanup: () => Promise<void>
): Promise<Ok<"workflow-finished" | "step-finished", never> | Err<never, Error>> => {
  try {
    await routeFunction();
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
