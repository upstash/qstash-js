import type { Err, Ok } from "neverthrow";
import { err, ok } from "neverthrow";
import { QstashWorkflowError } from "../error";
import {
  NO_CONCURRENCY,
  WORKFLOW_FAILURE_HEADER,
  WORKFLOW_ID_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";
import type { FailureFunctionPayload, RawStep, Step, WorkflowServeOptions } from "./types";
import { nanoid } from "nanoid";
import type { WorkflowLogger } from "./logger";
import type { Client } from "../client";
import { WorkflowContext } from "./context";
import { recreateUserHeaders } from "./workflow-requests";

/**
 * Gets the request body. If that fails, returns undefined
 *
 * @param request request received in the workflow api
 * @returns request body
 */
export const getPayload = async (request: Request) => {
  try {
    return await request.text();
  } catch {
    return;
  }
};

/**
 * decodes a string encoded in base64
 *
 * @param encodedString base64 encoded string
 * @returns decoded string
 */
const decodeBase64 = (encodedString: string) => {
  return Buffer.from(encodedString, "base64").toString();
};

/**
 * Parses a request coming from Qstash. First parses the string as JSON, which will result
 * in a list of objects with messageId & body fields. Body will be base64 encoded.
 *
 * Body of the first item will be the body of the first request received in the workflow API.
 * Rest are steps in Qstash Workflow Step format.
 *
 * When returning steps, we add the initial payload as initial step. This is to make it simpler
 * in the rest of the code.
 *
 * @param rawPayload body of the request as a string as explained above
 * @returns intiial payload and list of steps
 */
const parsePayload = (rawPayload: string) => {
  const [encodedInitialPayload, ...encodedSteps] = JSON.parse(rawPayload) as RawStep[];

  // decode initial payload:
  const rawInitialPayload = decodeBase64(encodedInitialPayload.body);
  const initialStep: Step = {
    stepId: 0,
    stepName: "init",
    stepType: "Initial",
    out: rawInitialPayload,
    concurrent: NO_CONCURRENCY,
  };

  // remove "toCallback" and "fromCallback" steps:
  const stepsToDecode = encodedSteps.filter((step) => step.callType === "step");

  // decode & parse other steps:
  const otherSteps = stepsToDecode.map((rawStep) => {
    return JSON.parse(decodeBase64(rawStep.body)) as Step;
  });

  // join and deduplicate steps:
  const steps: Step[] = [initialStep, ...otherSteps];
  return {
    rawInitialPayload,
    steps,
  };
};

/**
 * Our steps list can potentially have duplicates. In this case, the
 * workflow SDK should get rid of the duplicates
 *
 * There are two potentials cases:
 * 1. Two results steps with equal stepId fields.
 * 2. Two plan steps with equal targetStep fields.
 *
 * @param steps steps with possible duplicates
 * @returns
 */
const deduplicateSteps = (steps: Step[]): Step[] => {
  const targetStepIds: number[] = [];
  const stepIds: number[] = [];
  const deduplicatedSteps: Step[] = [];

  for (const step of steps) {
    if (step.stepId === 0) {
      // Step is a plan step
      if (!targetStepIds.includes(step.targetStep ?? 0)) {
        deduplicatedSteps.push(step);
        targetStepIds.push(step.targetStep ?? 0);
      }
    } else {
      // Step is a result step
      if (!stepIds.includes(step.stepId)) {
        deduplicatedSteps.push(step);
        stepIds.push(step.stepId);
      }
    }
  }

  return deduplicatedSteps;
};

/**
 * Checks if the last step is duplicate. If so, we will discard
 * this call.
 *
 * @param steps steps list to check
 * @returns boolean denoting whether the last one is duplicate
 */
const checkIfLastOneIsDuplicate = async (
  steps: Step[],
  debug?: WorkflowLogger
): Promise<boolean> => {
  // return false if the length is 0 or 1
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  if (steps.length < 2) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const lastStep = steps.at(-1)!;
  const lastStepId = lastStep.stepId;
  const lastTargetStepId = lastStep.targetStep;
  for (let index = 0; index < steps.length - 1; index++) {
    const step = steps[index];
    if (step.stepId === lastStepId && step.targetStep === lastTargetStepId) {
      const message =
        `Qstash Workflow: The step '${step.stepName}' with id '${step.stepId}'` +
        "  has run twice during workflow execution. Rest of the workflow will continue running as usual.";
      await debug?.log("WARN", "RESPONSE_DEFAULT", message);
      console.warn(message);
      return true;
    }
  }
  return false;
};

/**
 * Validates the incoming request checking the workflow protocol
 * version and whether it is the first invocation.
 *
 * Raises `QstashWorkflowError` if:
 * - it's not the first invocation and expected protocol version doesn't match
 *   the request.
 * - it's not the first invocation but there is no workflow id in the headers.
 *
 * @param request request received
 * @returns whether it's the first invocation and the workflow id
 */
export const validateRequest = (
  request: Request
): { isFirstInvocation: boolean; workflowRunId: string } => {
  const versionHeader = request.headers.get(WORKFLOW_PROTOCOL_VERSION_HEADER);
  const isFirstInvocation = !versionHeader;

  // if it's not the first invocation, verify that the workflow protocal version is correct
  if (!isFirstInvocation && versionHeader !== WORKFLOW_PROTOCOL_VERSION) {
    throw new QstashWorkflowError(
      `Incompatible workflow sdk protocol version. Expected ${WORKFLOW_PROTOCOL_VERSION},` +
        ` got ${versionHeader} from the request.`
    );
  }

  // get workflow id
  const workflowRunId = isFirstInvocation
    ? `wfr_${nanoid()}`
    : request.headers.get(WORKFLOW_ID_HEADER) ?? "";
  if (workflowRunId.length === 0) {
    throw new QstashWorkflowError("Couldn't get workflow id from header");
  }

  return {
    isFirstInvocation,
    workflowRunId,
  };
};

/**
 * Checks request headers and body
 * - Reads the request body as raw text
 * - Returns the steps. If it's the first invocation, steps are empty.
 *   Otherwise, steps are generated from the request body.
 *
 * @param request Request received
 * @returns raw intial payload and the steps
 */
export const parseRequest = async (
  requestPayload: string | undefined,
  isFirstInvocation: boolean,
  debug?: WorkflowLogger
): Promise<{
  rawInitialPayload: string;
  steps: Step[];
  isLastDuplicate: boolean;
}> => {
  if (isFirstInvocation) {
    // if first invocation, return and `serve` will handle publishing the JSON to QStash
    return {
      rawInitialPayload: requestPayload ?? "",
      steps: [],
      isLastDuplicate: false,
    };
  } else {
    // if not the first invocation, make sure that body is not empty and parse payload
    if (!requestPayload) {
      throw new QstashWorkflowError("Only first call can have an empty body");
    }
    const { rawInitialPayload, steps } = parsePayload(requestPayload);
    const isLastDuplicate = await checkIfLastOneIsDuplicate(steps, debug);
    const deduplicatedSteps = deduplicateSteps(steps);

    return {
      rawInitialPayload,
      steps: deduplicatedSteps,
      isLastDuplicate,
    };
  }
};

/**
 * checks if Upstash-Workflow-Is-Failure header is set to "true". If so,
 * attempts to call the failureFunction function.
 *
 * If the header is set but failureFunction is not passed, returns
 * QstashWorkflowError.
 *
 * @param request incoming request
 * @param failureFunction function to handle the failure
 */
export const handleFailure = async <TInitialPayload>(
  request: Request,
  requestPayload: string,
  qstashClient: Client,
  initialPayloadParser: Required<
    WorkflowServeOptions<Response, TInitialPayload>
  >["initialPayloadParser"],
  failureFunction?: WorkflowServeOptions<Response, TInitialPayload>["failureFunction"],
  debug?: WorkflowLogger
): Promise<Ok<"is-failure-callback" | "not-failure-callback", never> | Err<never, Error>> => {
  if (request.headers.get(WORKFLOW_FAILURE_HEADER) !== "true") {
    return ok("not-failure-callback");
  }

  if (!failureFunction) {
    return err(
      new QstashWorkflowError(
        "Workflow endpoint is called to handle a failure," +
          " but a failureFunction is not provided in serve options." +
          " Either provide a failureUrl or a failureFunction."
      )
    );
  }

  try {
    const { status, header, body, url, sourceHeader, sourceBody, workflowRunId } = JSON.parse(
      requestPayload
    ) as {
      status: number;
      header: Record<string, string[]>;
      body: string;
      url: string;
      sourceHeader: Record<string, string[]>;
      sourceBody: string;
      workflowRunId: string;
    };

    const decodedBody = body ? atob(body) : "{}";
    const errorPayload = JSON.parse(decodedBody) as FailureFunctionPayload;

    // parse steps
    const {
      rawInitialPayload,
      steps,
      isLastDuplicate: _isLastDuplicate,
    } = await parseRequest(atob(sourceBody), false, debug);

    // create context
    const workflowContext = new WorkflowContext<TInitialPayload>({
      qstashClient,
      workflowRunId,
      initialPayload: initialPayloadParser(rawInitialPayload),
      rawInitialPayload,
      headers: recreateUserHeaders(new Headers(sourceHeader) as Headers),
      steps,
      url: url,
      failureUrl: url,
      debug,
    });

    await failureFunction(workflowContext, status, errorPayload.message, header);
  } catch (error) {
    return err(error as Error);
  }

  return ok("is-failure-callback");
};
