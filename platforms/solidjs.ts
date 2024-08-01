import type { APIEvent, APIHandler } from "@solidjs/start/server";
import { Receiver } from "../src";

type VerifySignatureConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockTolerance?: number;
};

export const verifySignatureSolidjs = (
  handler: APIHandler,
  config?: VerifySignatureConfig
): APIHandler => {
  const currentSigningKey = config?.currentSigningKey ?? process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey) {
    throw new Error("currentSigningKey is required, either in the config or from the env");
  }
  const nextSigningKey = config?.nextSigningKey ?? process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!nextSigningKey) {
    throw new Error("nextSigningKey is required, either in the config or from the env");
  }
  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
  return async (event: APIEvent) => {
    const signature = event.request.headers.get("upstash-signature");
    if (!signature) {
      return new Response("`Upstash-Signature` header is missing", { status: 403 });
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }
    const cloneRequest = event.request.clone();
    const body = await cloneRequest.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      return new Response("invalid signature", { status: 403 });
    }
    return handler(event);
  };
};
