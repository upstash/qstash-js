import type { H3Event } from "h3";
import { defineEventHandler, getHeader, readRawBody } from "h3";
import { Receiver } from "../src";

type VerifySignatureConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockTolerance?: number;
};

export const verifySignatureNuxt = (
  handler: (event: H3Event) => Promise<unknown>,
  config?: VerifySignatureConfig
) => {
  const currentSigningKey = config?.currentSigningKey ?? process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey) {
    throw new Error(
      "currentSigningKey is required, either in the config or as env variable QSTASH_CURRENT_SIGNING_KEY"
    );
  }
  const nextSigningKey = config?.nextSigningKey ?? process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!nextSigningKey) {
    throw new Error(
      "nextSigningKey is required, either in the config or as env variable QSTASH_NEXT_SIGNING_KEY"
    );
  }
  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });

  return defineEventHandler(async (event: H3Event) => {
    const signature = getHeader(event, "upstash-signature");
    if (!signature) {
      return { status: 403, body: "`Upstash-Signature` header is missing" };
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }

    const body = await readRawBody(event);
    const isValid = await receiver.verify({
      signature,
      body: JSON.stringify(body),
      clockTolerance: config?.clockTolerance,
    });

    if (!isValid) {
      return { status: 403, body: "invalid signature" };
    }

    event._requestBody = body;

    return handler(event);
  });
};
