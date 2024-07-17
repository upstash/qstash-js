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
