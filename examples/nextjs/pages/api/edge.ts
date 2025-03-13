import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs";

async function handler(req: NextRequest) {
  console.log(req.headers);

  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success");
  console.log(typeof req.body, { body: req.body });
  return NextResponse.json({ name: "John Doe", body: req.body });
}

export default verifySignatureAppRouter(handler);

export const config = {
  runtime: "edge",
  api: {
    bodyParser: false,
  },
};
