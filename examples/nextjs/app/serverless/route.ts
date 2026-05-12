import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";

async function handler(_req: Request) {
  // simulate work
  await new Promise((r) => setTimeout(r, 1000));

  console.log("Success");
  return NextResponse.json({ name: "John Doe Serverless" });
}
export const POST = verifySignatureAppRouter(handler);
