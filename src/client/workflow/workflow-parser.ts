import type { Step } from "./types";

export const getPayload = async (request: Request) => {
  try {
    return await request.text();
  } catch {
    return;
  }
};

const decodeBase64 = (encodedString: string) => {
  return Buffer.from(encodedString, "base64").toString();
};

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
