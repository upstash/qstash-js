import type { NextApiRequest, NextApiResponse } from "next";
import { verifySignature } from "@upstash/qstash/nextjs";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(req.headers);

  res.status(200).json({ name: "John Doe", body: req.body });
}

export default verifySignature(handler, {
  "currentSigningKey": "sig_3xVnLBEC758CtJcqW8hfkRjhe7cj2XBANdeVRxta32P9zXZm9o",
  "nextSigningKey": "sig_4dMSAQ1M4mmYGeSTPFX8ikFVbdq1k4bbknJKH8PoRsWy39kBWX",
});

export const config = {
  api: {
    bodyParser: false,
  },
};
