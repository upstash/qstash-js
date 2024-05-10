/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Hono } from "hono";

export type MessageDetails = {
  headers: any;
  body: string;
  callback?: string;
  retryCount?: number;
};

export const messageIds = new Map<string | null | undefined, MessageDetails>();

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Bun!");
});

app.post("/message", async (c) => {
  console.warn("Just received a call from", c.req.raw.headers.get("upstash-message-id"));

  if (c.req.raw.headers.get("bypass-tunnel-reminder") === "client-test") {
    const body = await c.req.text();

    messageIds.set(c.req.raw.headers.get("upstash-message-id"), {
      headers: c.req.raw.headers as unknown as Record<string, unknown>,
      body,
    });
  }
  return c.json({ message: "Hello Bun!" });
});

app.post("/failed-message", async (c) => {
  const messageId = c.req.raw.headers.get("upstash-message-id");
  console.warn("Just received a call from throwing error", messageId);

  messageIds.set(messageId, {
    headers: c.req.raw.headers as unknown as Record<string, unknown>,
    body: "",
    retryCount: (messageIds.get(messageId)?.retryCount ?? 0) + 1,
  });

  return c.notFound();
});

app.post("/failed-callback", async (c) => {
  console.warn("Running failed callback");
  const body = await c.req.json<Record<string, unknown>>();
  const sourceMessageId = body.sourceMessageId as string | undefined;
  const originalMessage = messageIds.get(sourceMessageId);
  if (!originalMessage) return c.json({ message: "originalMessage missing!" });

  messageIds.set(sourceMessageId, {
    ...originalMessage,
    callback: sourceMessageId,
  });

  return c.json({ message: "upstash" });
});

app.post("/message-callback", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const sourceMessageId = body.sourceMessageId as string | undefined;
  const originalMessage = messageIds.get(sourceMessageId);
  if (!originalMessage) return c.json({ message: "originalMessage missing!" });

  messageIds.set(sourceMessageId, {
    ...originalMessage,
    callback: sourceMessageId,
  });

  return c.json({ message: "upstash" });
});

app.get("/publish-verify", (c) => {
  const messageIdFromParameters = c.req.query("messageId");
  const selectedMessageId = messageIds.get(messageIdFromParameters);

  return c.json(selectedMessageId);
});

app.post("/topic1", async (c) => {
  console.warn("TOPIC1: Just received a call from", c.req.raw.headers.get("upstash-message-id"));

  if (c.req.raw.headers.get("bypass-tunnel-reminder") === "client-test") {
    const body = await c.req.text();

    messageIds.set(c.req.raw.headers.get("upstash-message-id"), {
      headers: c.req.raw.headers as unknown as Record<string, unknown>,
      body,
    });
  }
  return c.json({ hello: "world" });
});

app.post("/topic2", async (c) => {
  console.warn("TOPIC2: Just received a call from", c.req.raw.headers.get("upstash-message-id"));

  if (c.req.raw.headers.get("bypass-tunnel-reminder") === "client-test") {
    const body = await c.req.text();

    messageIds.set(c.req.raw.headers.get("upstash-message-id"), {
      headers: c.req.raw.headers as unknown as Record<string, unknown>,
      body,
    });
  }
  return c.json({ hello: "world" });
});

console.log("Proxy server is listening on port:", process.env.PORT);

export default {
  port: process.env.PORT,
  fetch: app.fetch,
};
