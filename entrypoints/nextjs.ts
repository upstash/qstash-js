// @ts-ignore Deno can't compile
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

// @ts-ignore Deno can't compile
import { buffer } from "micro";

import { Consumer } from "../pkg/consumer.ts";
export type VerifySignaturConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;

  /**
   * The url of this api route, including the protocol.
   *
   * If you omit this, the url will be automatically determined by checking the `VERCEL_URL` env variable and assuming `https`
   */
  url?: string;
};
export function verifySignature(
  handler: NextApiHandler,
  config?: VerifySignaturConfig,
): NextApiHandler {
  const currentSigningKey = config?.currentSigningKey ??
    // @ts-ignore Deno can't compile
    process.env.get["QSTASH_CURRENT_SIGNING_KEY"];
  if (!currentSigningKey) {
    throw new Error(
      "currentSigningKey is required, either in the config or as env variable QSTASH_CURRENT_SIGNING_KEY",
    );
  }
  const nextSigningKey = config?.nextSigningKey ??
    // @ts-ignore Deno can't compile
    process.env.get["QSTASH_NEXT_SIGNING_KEY"];
  if (!nextSigningKey) {
    throw new Error(
      "nextSigningKey is required, either in the config or as env variable QSTASH_NEXT_SIGNING_KEY",
    );
  }
  const consumer = new Consumer({
    currentSigningKey,
    nextSigningKey,
    subtleCrypto: crypto.subtle,
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
    console.log(req.headers);

    const url = config?.url ?? new URL(
      req.url!,
      `https://${process.env.VERCEL_URL}`,
    ).href;

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
