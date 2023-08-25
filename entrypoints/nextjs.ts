// @ts-ignore Deno can't compile
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

import { Receiver } from "../pkg/receiver";
export type VerifySignaturConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;

  /**
   * The url of this api route, including the protocol.
   *
   * If you omit this, the url will be automatically determined by checking the `VERCEL_URL` env variable and assuming `https`
   */
  url?: string;

  /**
   * Number of seconds to tolerate when checking `nbf` and `exp` claims, to deal with small clock differences among different servers
   *
   * @default 0
   */
  clockTolerance?: number;
};
export function verifySignature(
  handler: NextApiHandler,
  config?: VerifySignaturConfig,
): NextApiHandler {
  const currentSigningKey =
    config?.currentSigningKey ??
    // @ts-ignore Deno can't compile
    process.env["QSTASH_CURRENT_SIGNING_KEY"];
  if (!currentSigningKey) {
    throw new Error(
      "currentSigningKey is required, either in the config or as env variable QSTASH_CURRENT_SIGNING_KEY",
    );
  }
  const nextSigningKey =
    config?.nextSigningKey ??
    // @ts-ignore Deno can't compile
    process.env["QSTASH_NEXT_SIGNING_KEY"];
  if (!nextSigningKey) {
    throw new Error(
      "nextSigningKey is required, either in the config or as env variable QSTASH_NEXT_SIGNING_KEY",
    );
  }
  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
    subtleCrypto: crypto.subtle,
  });

  return async (req: NextApiRequest, res: NextApiResponse) => {
    // @ts-ignore This can throw errors during vercel build
    const signature = req.headers["upstash-signature"];
    if (!signature) {
      throw new Error("`Upstash-Signature` header is missing");
    }
    if (typeof signature !== "string") {
      throw new Error("`Upstash-Signature` header is not a string");
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks).toString("utf-8");

    // const url = config?.url ?? new URL(
    //   req.url!,
    //   `https://${process.env.VERCEL_URL}`,
    // ).href;

    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
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
    }

    return handler(req, res);
  };
}
