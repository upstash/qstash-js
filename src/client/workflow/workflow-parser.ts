import type { Step } from "./types";

export const parsePayload = async (request: Request) => {
  try {
    return (await request.json()) as string[];
  } catch {
    return;
  }
};

export const generateSteps = (payload: string[]) => {
  const steps = payload.map((rawStep) => {
    return JSON.parse(JSON.parse(Buffer.from(rawStep, "base64").toString()) as string) as Step;
  });
  return steps;
};
