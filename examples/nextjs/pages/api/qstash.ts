import type { NextApiRequest, NextApiResponse } from "next";
import { verifySignature } from "@upstash/qstash/nextjs";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(req.headers);

  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success")
  res.status(200).json({ name: "John Doe", body: req.body });
}

export default verifySignature(handler, {
  "currentSigningKey": "sig_6TPD6JRa4NLZJ2YwjVWWXCH6K833",
  "nextSigningKey": "sig_5Xm8oz4X8V9LuqeGB6PVxATXYB5z",
  url: "http://localhost:3000/api/qstash",
});

export const config = {
  api: {
    bodyParser: false,
  },
};
