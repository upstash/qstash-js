import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

// Publicly reachable endpoint with a verifier. QStash delivers the signed
// message here and verifySignatureAppRouter validates the signature using the
// QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY env vars. Returning 200
// is what makes QStash mark the message as DELIVERED.
export const dynamic = "force-dynamic";

export const POST = verifySignatureAppRouter(async () => {
  return NextResponse.json({ ok: true });
});
