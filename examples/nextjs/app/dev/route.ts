import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash";

// Don't run at build time — devMode talks to a local QStash binary.
export const dynamic = "force-dynamic";

const client = new Client({ token: "dev-token", devMode: true });

export const GET = async () => {
  const { messageId } = await client.publishJSON({
    url: "https://example.com",
    body: { hello: "from /dev route" },
  });
  return NextResponse.json({ ok: true, messageId });
};
