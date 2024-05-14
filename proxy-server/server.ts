import type { Context } from "hono";
import { Hono } from "hono";

export type MessageDetails = {
  headers: Record<string, unknown>;
  body: string;
  callback?: string;
  retryCount?: number;
};

export const messageIds = new Map<string | null | undefined, MessageDetails>();

const app = new Hono();

const HEADER_MESSAGE_ID = "upstash-message-id";
const HEADER_BYPASS_TUNNEL = "bypass-tunnel-reminder";
const CLIENT_TEST_VALUE = "client-test";

app.get("/", (c) => c.text("Hello Bun!"));

const handleMessage = async (c: Context, topic: string) => {
  console.warn(`${topic}: Just received a call from`, c.req.raw.headers.get(HEADER_MESSAGE_ID));

  if (c.req.raw.headers.get(HEADER_BYPASS_TUNNEL) === CLIENT_TEST_VALUE) {
    const body = await c.req.text();

    messageIds.set(c.req.raw.headers.get(HEADER_MESSAGE_ID), {
      headers: c.req.raw.headers as unknown as Record<string, unknown>,
      body,
    });
  }
  return c.json({ hello: "world" });
};

app.post("/message", async (c) => {
  console.warn("Just received a call from", c.req.raw.headers.get(HEADER_MESSAGE_ID));

  if (c.req.raw.headers.get(HEADER_BYPASS_TUNNEL) === CLIENT_TEST_VALUE) {
    const body = await c.req.text();

    messageIds.set(c.req.raw.headers.get(HEADER_MESSAGE_ID), {
      headers: c.req.raw.headers as unknown as Record<string, unknown>,
      body,
    });
  }
  return c.json({ message: "Hello Bun!" });
});

app.post("/failed-message", async (c) => {
  const messageId = c.req.raw.headers.get(HEADER_MESSAGE_ID);
  console.warn("Just received a call from throwing error", messageId);

  messageIds.set(messageId, {
    headers: c.req.raw.headers as unknown as Record<string, unknown>,
    body: "",
    retryCount: (messageIds.get(messageId)?.retryCount ?? 0) + 1,
  });

  return c.notFound();
});

const handleCallback = async (c: Context, message: string) => {
  const body = await c.req.json<Record<string, unknown>>();
  const sourceMessageId = body.sourceMessageId as string | undefined;
  const originalMessage = messageIds.get(sourceMessageId);
  if (!originalMessage) return c.json({ message: "originalMessage missing!" });

  messageIds.set(sourceMessageId, {
    ...originalMessage,
    callback: sourceMessageId,
  });

  return c.json({ message });
};

app.post("/failed-callback", (c) => handleCallback(c, "upstash"));
app.post("/message-callback", (c) => handleCallback(c, "upstash"));

app.get("/publish-verify", (c) => {
  const messageIdFromParameters = c.req.query("messageId");
  const selectedMessageId = messageIds.get(messageIdFromParameters);

  return c.json(selectedMessageId);
});

app.get("/publish-verify-multiple", (c) => {
  const messageIdFromParameters = new URL(c.req.url).searchParams.getAll("messageId");
  const internalMessageIds = [];

  for (const messageId of messageIdFromParameters) {
    internalMessageIds.push(messageIds.get(messageId));
  }
  return c.json(internalMessageIds);
});

app.post("/topic1", (c) => handleMessage(c, "TOPIC1"));
app.post("/topic2", (c) => handleMessage(c, "TOPIC2"));

console.warn("Proxy server is listening on port:", process.env.PORT);

export default {
  port: process.env.PORT,
  fetch: app.fetch,
};
