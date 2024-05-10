import { Hono } from "hono";

export type MessageDetails = {
  headers: Record<any, any>;
  body: string;
};

const messageIds: Map<string | null | undefined, MessageDetails> = new Map();

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Bun!");
});

app.post("/message", async (c) => {
  console.log("Just received a call from");
  if (c.req.raw.headers.get("bypass-tunnel-reminder") === "client-test") {
    const body = await c.req.text();
    console.log({
      headers: c.req.raw.headers,
      body,
    });
    messageIds.set(c.req.raw.headers.get("upstash-message-id"), {
      headers: c.req.raw.headers,
      body,
    });
  }
  return c.text("Hello Bun!");
});

app.get("/publish-verify", (c) => {
  const messageIdFromParams = c.req.query("messageId");
  const selectedMessageId = messageIds.get(messageIdFromParams);

  messageIds.delete(messageIdFromParams);
  return c.json(selectedMessageId);
});

console.log("Proxy server is listening on port:", process.env.PORT);

export default {
  port: process.env.PORT,
  fetch: app.fetch,
};
