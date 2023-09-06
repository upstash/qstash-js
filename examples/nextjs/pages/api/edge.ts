import { NextRequest, NextResponse } from "next/server";
import { Nextjs } from "@upstash/qstash";

async function handler(req: NextRequest) {
  console.log(req.headers);

  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success");
  console.log(typeof req.body, { body: req.body });
  return NextResponse.json({ name: "John Doe", body: req.body });
}

export default Nextjs.verifySignatureEdge(handler);

export const config = {
  runtime: "edge",
  api: {
    bodyParser: false,
  },
};
