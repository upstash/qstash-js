import type { Step } from "./types";

export const parsePayload = async (request: Request) => {
  try {
    return await request.text();
  } catch {
    return;
  }
};

export const generateSteps = (rawPayload: string) => {
  const payload = JSON.parse(rawPayload) as { messageId: string; body: string }[];

  const steps = payload.map((rawStep) => {
    return JSON.parse(JSON.parse(Buffer.from(rawStep.body, "base64").toString()) as string) as Step;
  });
  return steps;
};
