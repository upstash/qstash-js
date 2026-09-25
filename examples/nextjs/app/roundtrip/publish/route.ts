import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash";

// Publishes a message to this same app's /roundtrip/verify endpoint and returns
// the message id so the test can follow it in the message logs.
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  if (!process.env.QSTASH_TOKEN) {
    throw new Error("CI test failed. QSTASH_TOKEN is missing.");
  }

  const client = new Client({ token: process.env.QSTASH_TOKEN });
  const origin = new URL(request.url).origin;
  const { messageId } = await client.publishJSON({
    url: `${origin}/roundtrip/verify`,
    body: { hello: "qstash-js nextjs ci" },
  });

  return NextResponse.json({ messageId });
};
