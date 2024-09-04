/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeAll, describe, expect, test } from "bun:test";
import { Client } from "./client";

describe("Messages", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  beforeAll(async () => {
    await client.messages.deleteAll();
  });

  test(
    "should send message, cancel it then verify cancel",
    async () => {
      const message = await client.publishJSON({
        url: `https://example.com`,
        body: { hello: "world" },
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        delay: 60,
        retries: 5,
        callback: "https://example.com?foo=bar",
        failureCallback: "https://example.com?bar=baz",
        method: "GET",
      });

      const verifiedMessage = await client.messages.get(message.messageId);
      expect(new Headers(verifiedMessage.header).get("Test-Header")).toBe("test-value");
      await client.messages.delete(message.messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should send message with timeout",
    async () => {
      const message = await client.publishJSON({
        url: `https://example.com`,
        body: { hello: "world" },
        timeout: 90,
      });

      const verifiedMessage = await client.messages.get(message.messageId);
      expect(verifiedMessage.messageId).toBeTruthy();
      await client.messages.delete(message.messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should delete many and all",
    async () => {
      const messages = await client.batchJSON([
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: 10,
        },
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: 10,
        },
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: "10d",
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      expect(messages.length).toBe(3);

      const deleted = await client.messages.deleteMany([
        messages[0].messageId,
        messages[1].messageId,
      ]);

      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      expect(deleted).toBe(2);

      const deletedAll = await client.messages.deleteAll();
      expect(deletedAll).toBe(1);
    },
    { timeout: 20_000 }
  );
});
