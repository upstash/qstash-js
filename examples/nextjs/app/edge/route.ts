import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

async function handler(_req: Request) {
  // simulate work
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success");
  return NextResponse.json({ name: "John Doe" });
}

export const POST = verifySignatureAppRouter(handler);

export const runtime = "edge";
