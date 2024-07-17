import type { Step } from "./types";

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
export const parsePayload = (rawPayload: string) => {
  const [encodedInitialPayload, ...encodedSteps] = JSON.parse(rawPayload) as {
    messageId: string;
    body: string;
  }[];

  const initialPayload = decodeBase64(encodedInitialPayload.body);
  const steps = encodedSteps.map((rawStep) => {
    return JSON.parse(JSON.parse(decodeBase64(rawStep.body)) as string) as Step;
  });
  const initialStep: Step = {
    stepId: 0,
    stepName: "init",
    out: initialPayload,
    concurrent: 1,
    targetStep: 0,
  };
  return {
    initialPayload,
    steps: [initialStep, ...steps],
  };
};
