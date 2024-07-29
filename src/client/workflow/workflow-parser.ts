import { QstashWorkflowError } from "../error";
import {
  WORKFLOW_ID_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";
import type { Step } from "./types";
import { nanoid } from "nanoid";

/**
 * Gets the request body. If that fails, returns undefined
 *
 * @param request request received in the workflow api
 * @returns request body
 */
const getPayload = async (request: Request) => {
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
  const [encodedInitialPayload, ...encodedSteps] = JSON.parse(rawPayload) as {
    messageId: string;
    body: string;
    callType: "step" | "toCallback" | "fromCallback";
  }[];

  const stepsToDecode = encodedSteps.filter((step) => step.callType === "step");

  const initialPayload = decodeBase64(encodedInitialPayload.body);
  const steps = stepsToDecode.map((rawStep) => {
    return JSON.parse(decodeBase64(rawStep.body)) as Step;
  });
  const initialStep: Step = {
    stepId: 0,
    stepName: "init",
    stepType: "Initial",
    out: initialPayload,
    concurrent: 1,
    targetStep: 0,
  };
  return {
    initialPayload,
    steps: [initialStep, ...steps],
  };
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
): { isFirstInvocation: boolean; workflowId: string } => {
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
  const workflowId = isFirstInvocation
    ? `wf${nanoid()}`
    : request.headers.get(WORKFLOW_ID_HEADER) ?? "";
  if (workflowId.length === 0) {
    throw new QstashWorkflowError("Couldn't get workflow id from header");
  }

  return {
    isFirstInvocation,
    workflowId,
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
  request: Request,
  isFirstInvocation: boolean
): Promise<{
  initialPayload: string;
  steps: Step[];
}> => {
  // get payload as raw string
  const payload = await getPayload(request);

  if (isFirstInvocation) {
    // if first invocation, return and `serve` will handle publishing the JSON to QStash
    return {
      initialPayload: payload ?? "",
      steps: [],
    };
    // if not the first invocation, make sure that body is not empty and parse payload
  } else {
    if (!payload) {
      throw new QstashWorkflowError("Only first call can have an empty body");
    }
    const { initialPayload, steps } = parsePayload(payload);

    return {
      initialPayload,
      steps,
    };
  }
};
