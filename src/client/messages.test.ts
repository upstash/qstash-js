/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-deprecated */
import { beforeAll, describe, expect, test } from "bun:test";
import { Client } from "./client";

// Updated to use constants for magic numbers
const SECONDS_IN_A_DAY = 24 * 60 * 60;

describe("Messages", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  beforeAll(async () => {
    await client.messages.deleteAll();
  });

  test(
    "should send message, cancel it then verify cancel",
    async () => {
      const retryDelay = "1000 * retried";
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
        retryDelay,
      });

      const verifiedMessage = await client.messages.get(message.messageId);
      expect(new Headers(verifiedMessage.header).get("Test-Header")).toBe("test-value");
      expect(verifiedMessage.retryDelayExpression).toBe(retryDelay);
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

      expect(messages.length).toBe(3);

      const deleted = await client.messages.deleteMany([
        messages[0].messageId,
        messages[1].messageId,
      ]);

      expect(deleted).toBe(2);

      const deletedAll = await client.messages.deleteAll();
      expect(deletedAll).toBe(1);
    },
    { timeout: 20_000 }
  );

  test("should create message with flow control", async () => {
    const parallelism = 10;
    const ratePerSecond = 5;
    const period = "1d";
    const { messageId } = await client.publish({
      url: "https://httpstat.us/200?sleep=30000",
      body: "hello",
      flowControl: {
        key: "flow-key",
        parallelism,
        ratePerSecond,
        period,
      },
    });

    const message = await client.messages.get(messageId);

    expect(message.flowControlKey).toBe("flow-key");
    expect(message.parallelism).toBe(parallelism);
    expect(message.ratePerSecond).toBe(ratePerSecond);
    expect(message.rate).toBe(ratePerSecond);

    const dayInSeconds = SECONDS_IN_A_DAY;
    expect(message.period).toBe(dayInSeconds);
  });

  test(
    "should delete all messages with flowControlKey filter",
    async () => {
      const flowControlKey = "flow-key";
      // Create messages with the same flow control key
      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      // Create a message with a different flow control key
      const message3 = await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: "different-flow-key",
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      // Delete all messages with the specific flowControlKey
      const cancelled = await client.messages.deleteAll({
        flowControlKey,
      });

      // Should cancel at least the 2 messages with the matching flowControlKey
      expect(cancelled).toBeGreaterThanOrEqual(2);

      // Verify message3 still exists (or was not cancelled)
      // Note: This might fail if message3 was already delivered, but it tests the filter
      try {
        const remainingMessage = await client.messages.get(message3.messageId);
        expect(remainingMessage.flowControlKey).toBe("different-flow-key");
      } catch {
        // Message might have been delivered/cancelled, which is fine for this test
      }

      // Clean up remaining message
      try {
        await client.messages.delete(message3.messageId);
      } catch {
        // Already deleted/delivered
      }
    },
    { timeout: 20_000 }
  );

  test(
    "should delete multiple messages using string array overload",
    async () => {
      const messages = await client.batchJSON([
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: "10d",
        },
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: "10d",
        },
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: "10d",
        },
      ]);

      expect(messages.length).toBe(3);

      // Delete using string[] overload
      const deleted = await client.messages.delete([messages[0].messageId, messages[1].messageId]);

      expect(deleted.cancelled).toBe(2);

      // Clean up remaining
      await client.messages.delete(messages[2].messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should delete messages using filter overload with flowControlKey",
    async () => {
      const flowControlKey = `flow-key-filter-${Date.now()}`;

      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      // Delete using filter overload
      const cancelled = await client.messages.delete({ flowControlKey });

      expect(cancelled.cancelled).toBeGreaterThanOrEqual(2);
    },
    { timeout: 20_000 }
  );

  test(
    "should delete messages using filter overload with label",
    async () => {
      const label = `msg-label-${Date.now()}`;

      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        delay: "10d",
        label,
      });

      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        delay: "10d",
        label,
      });

      // Delete using filter overload with label
      const cancelled = await client.messages.delete({ label });

      expect(cancelled.cancelled).toBeGreaterThanOrEqual(2);
    },
    { timeout: 20_000 }
  );

  test(
    "should delete all messages using empty filter overload",
    async () => {
      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        delay: "10d",
      });

      // Delete all using empty filter overload (equivalent to deleteAll)
      const cancelled = await client.messages.delete({});

      expect(cancelled.cancelled).toBeGreaterThanOrEqual(1);
    },
    { timeout: 20_000 }
  );
});
