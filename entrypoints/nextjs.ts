// @ts-ignore Deno can't compile
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

import { buffer } from "micro";

import { Consumer } from "../consumer.ts";
export type VerifySignaturConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;
};
export function verifySignature(
  handler: NextApiHandler,
  config?: VerifySignaturConfig,
): NextApiHandler {
  const currentSigningKey = config?.currentSigningKey ??
    process.env.get["QSTASH_CURRENT_SIGNING_KEY"];
  if (!currentSigningKey) {
    throw new Error(
      "currentSigningKey is required, either in the config or as env variable QSTASH_CURRENT_SIGNING_KEY",
    );
  }
  const nextSigningKey = config?.nextSigningKey ??
    process.env.get["QSTASH_NEXT_SIGNING_KEY"];
  if (!nextSigningKey) {
    throw new Error(
      "nextSigningKey is required, either in the config or as env variable QSTASH_NEXT_SIGNING_KEY",
    );
  }
  const consumer = new Consumer({
    currentSigningKey,
    nextSigningKey,
  });

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const signature = req.headers["upstash-signature"];
    if (!signature) {
      throw new Error("`Upstash-Signature` header is missing");
    }
    if (typeof signature !== "string") {
      throw new Error("`Upstash-Signature` header is not a string");
    }

    const body = (await buffer(req)).toString();

    const url = new URL(req.url!, `https://${req.headers.host}`).href;
    console.log({ reqUrl: req.url, url });

    const isValid = await consumer.verify({ signature, body, url });
    if (!isValid) {
      res.status(400);
      res.send("Invalid signature");
      return res.end();
    }

    try {
      if (req.headers["content-type"] === "application/json") {
        req.body = JSON.parse(body);
      } else {
        req.body = body;
      }
    } catch {
      req.body = body;
      console.log("body is not json");
    }

    return handler(req, res);
  };
}
