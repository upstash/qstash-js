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
  "currentSigningKey": "sig_3XkV1SD5puLtBKyGAWHVfktnkaqwMQFV2qkYRXJNmSSDoyYysc",
  "nextSigningKey": "sig_3coKFaxVLdU8sk8FiURFtJeePitgk19NSqMxZSnzXq2ckiCALJ",
});

export const config = {
  api: {
    bodyParser: false,
  },
};
