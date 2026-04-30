import { NextResponse } from "next/server";
import { Client } from "@upstash/qstash";

const client = new Client({ token: "dev-token", devMode: true });

export const GET = async (request: Request) => {
  const origin = new URL(request.url).origin;
  const { messageId } = await client.publishJSON({
    url: `${origin}/dev/receive`,
    body: { hello: "from /dev/send" },
  });
  return NextResponse.json({ ok: true, messageId });
};
