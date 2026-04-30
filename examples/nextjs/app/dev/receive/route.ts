import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

// Module-scoped set so the test can poll for delivery via GET ?check=<id>.
const received = new Set<string>();

export const POST = verifySignatureAppRouter(
  async (request) => {
    const messageId = request.headers.get("upstash-message-id");
    if (messageId) received.add(messageId);
    return NextResponse.json({ ok: true, messageId });
  },
  { devMode: true }
);

export const GET = (request: Request) => {
  const id = new URL(request.url).searchParams.get("check");
  return NextResponse.json({ received: id ? received.has(id) : false });
};
