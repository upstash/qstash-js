import { NextRequest, NextResponse } from "next/server";
import { verifySignatureEdge } from "@upstash/qstash/dist/nextjs";

async function handler(_req: NextRequest) {
  // simulate work
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success");
  return NextResponse.json({ name: "John Doe" });
}

export const POST = verifySignatureEdge(handler);

export const runtime = "edge";
