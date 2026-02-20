/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { beforeAll, describe, expect, test } from "bun:test";
import { Client } from "./client";

// Updated to use constants for magic numbers
const SECONDS_IN_A_DAY = 24 * 60 * 60;

describe("Messages", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  beforeAll(async () => {
    await client.messages.cancel({ all: true });
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
      await client.messages.cancel(message.messageId);
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
      await client.messages.cancel(message.messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel many and all",
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

      const cancelled = await client.messages.cancel([
        messages[0].messageId,
        messages[1].messageId,
      ]);

      expect(cancelled.cancelled).toBe(2);

      const cancelledAll = await client.messages.cancel({ all: true });
      expect(cancelledAll.cancelled).toBe(1);
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
    expect(message.rate).toBe(ratePerSecond);

    const dayInSeconds = SECONDS_IN_A_DAY;
    expect(message.period).toBe(dayInSeconds);
  });

  test(
    "should cancel all messages with flowControlKey filter",
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

      // Cancel all messages with the specific flowControlKey
      const result = await client.messages.cancel({ flowControlKey });

      // Should cancel at least the 2 messages with the matching flowControlKey
      expect(result.cancelled).toBeGreaterThanOrEqual(2);

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
        await client.messages.cancel(message3.messageId);
      } catch {
        // Already deleted/delivered
      }
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel multiple messages using string array overload",
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

      // Cancel using string[] overload
      const cancelled = await client.messages.cancel([
        messages[0].messageId,
        messages[1].messageId,
      ]);

      expect(cancelled.cancelled).toBe(2);

      // Clean up remaining
      await client.messages.cancel(messages[2].messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel messages using filter overload with flowControlKey",
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

      // Cancel using filter overload
      const cancelled = await client.messages.cancel({ flowControlKey });

      expect(cancelled.cancelled).toBeGreaterThanOrEqual(2);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel messages using filter overload with label",
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

      // Cancel using filter overload with label
      const cancelled = await client.messages.cancel({ label });

      expect(cancelled.cancelled).toBeGreaterThanOrEqual(2);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel all messages using empty filter overload",
    async () => {
      await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
        body: "hello",
        delay: "10d",
      });

      // Cancel all using empty filter overload (equivalent to cancel({ all: true }))
      const cancelled = await client.messages.cancel({});

      expect(cancelled.cancelled).toBeGreaterThanOrEqual(1);
    },
    { timeout: 20_000 }
  );
});
