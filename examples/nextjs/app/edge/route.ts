import { NextRequest, NextResponse } from "next/server";
import { verifySignatureEdge } from "@upstash/qstash/nextjs";

async function handler(req: NextRequest) {
  console.log(req.headers);

  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success");
  console.log(typeof req.body, { body: req.body });
  return NextResponse.json({ name: "John Doe", body: req.body });
}

export const POST = verifySignatureEdge(handler);

export const runtime = "edge";
