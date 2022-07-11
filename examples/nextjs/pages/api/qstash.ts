import type { NextApiRequest, NextApiResponse } from "next";
import { verifySignature } from "@upstash/qstash/nextjs";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(req.headers);

  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success");
  console.log(typeof req.body, { body: req.body });
  res.status(200).json({ name: "John Doe", body: req.body });
}

export default verifySignature(handler, {
  "currentSigningKey": "sig_5wKXQ6mPSerYPu6DRqYpA5dDjVZW",
  "nextSigningKey": "sig_6Psg6RgxALRgP1zFSvuqUim5Nsqc",
  url: "http://localhost:3000/api/qstash", // omit this when you deploy
});

export const config = {
  api: {
    bodyParser: false,
  },
};
