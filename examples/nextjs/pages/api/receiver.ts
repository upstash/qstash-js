/**
 * This example shows how to use the `Receiver` to manually verify the incoming request.
 * It might be useful in case you want to be able to call your endpoint as well as letting Upstash
 * call it.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { Receiver } from "@upstash/qstash";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const signature = req.headers["upstash-signature"] as string | undefined;
  console.log({ signature });
  if (!signature) {
    res.status(200).send("This request is not coming from qstash");
    return res.end();
  }

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey) {
    res.status(500).send("QSTASH_CURRENT_SIGNING_KEY is missing");
    return res.end();
  }
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!nextSigningKey) {
    res.status(500).send("QSTASH_NEXT_SIGNING_KEY is missing");
    return res.end();
  }
  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks).toString("utf-8");
  const valid = await receiver.verify({
    signature,
    body: body,
  });
  if (!valid) {
    res.status(403).send("Signature is invalid");
    return res.end();
  }

  res.status(200).json({ valid });
  return res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};
