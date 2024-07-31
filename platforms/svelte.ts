import type { RequestHandler } from "@sveltejs/kit";
import { Receiver } from "../src";

type VerifySignatureConfig = {
  currentSigningKey: string;
  nextSigningKey: string;
  clockTolerance?: number;
};

export const verifySignatureSvelte = <
  Parameters extends Partial<Record<string, string>> = Partial<Record<string, string>>,
  RouteId extends string | null = string | null,
>(
  handler: RequestHandler<Parameters, RouteId>,
  config: VerifySignatureConfig
) => {
  const currentSigningKey = config.currentSigningKey;
  if (!currentSigningKey) {
    throw new Error("currentSigningKey is required, either in the config or from the env");
  }
  const nextSigningKey = config.nextSigningKey;
  if (!nextSigningKey) {
    throw new Error("nextSigningKey is required, either in the config or from the env");
  }
  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
  const wrappedHandler: RequestHandler<Parameters, RouteId> = async (event) => {
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
      clockTolerance: config.clockTolerance,
    });
    if (!isValid) {
      return new Response("invalid signature", { status: 403 });
    }
    return handler(event);
  };
  return wrappedHandler;
};
