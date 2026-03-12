/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { describe, expect, test } from "bun:test";
import { Client } from "./client";

describe("FlowControl", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should publish with flow control, then get flow control info",
    async () => {
      const flowControlKey = `fc-info-${Date.now()}`;
      // Publish a message with flow control to ensure the key exists
      const { messageId } = await client.publish({
        url: "https://mock.httpstatus.io/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          rate: 10,
          period: "1m",
        },
      });

      // Get a single flow control by key
      const single = await client.flowControl.get(flowControlKey);
      expect(single.flowControlKey).toBe(flowControlKey);
      expect(typeof single.waitListSize).toBe("number");
      expect(typeof single.parallelismMax).toBe("number");
      expect(typeof single.parallelismCount).toBe("number");

      // Clean up the published message
      await client.messages.delete(messageId);
    },
    { timeout: 30_000 }
  );

  test(
    "should get global parallelism info",
    async () => {
      const info = await client.flowControl.getGlobalParallelism();
      expect(typeof info.parallelismMax).toBe("number");
      expect(typeof info.parallelismCount).toBe("number");
    },
    { timeout: 20_000 }
  );

  test(
    "should pause and resume a flow control key",
    async () => {
      const flowControlKey = `fc-pause-${Date.now()}`;
      // Publish a message with flow control to ensure the key exists
      const { messageId } = await client.publish({
        url: "https://mock.httpstatus.io/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          rate: 10,
          period: "1m",
        },
      });

      // Pause the flow control key
      await client.flowControl.pause(flowControlKey);

      // Verify it's paused
      const paused = await client.flowControl.get(flowControlKey);
      expect(paused.isPaused).toBe(true);

      // Resume the flow control key
      await client.flowControl.resume(flowControlKey);

      // Verify it's resumed
      const resumed = await client.flowControl.get(flowControlKey);
      expect(resumed.isPaused).toBe(false);

      // Clean up
      await client.messages.delete(messageId);
    },
    { timeout: 30_000 }
  );

  test(
    "should pin and unpin a flow control key configuration",
    async () => {
      const flowControlKey = `fc-pin-${Date.now()}`;
      // Publish a message with flow control to ensure the key exists
      const { messageId } = await client.publish({
        url: "https://mock.httpstatus.io/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          rate: 10,
          period: "1m",
        },
      });

      // Pin the configuration
      await client.flowControl.pin(flowControlKey, {
        parallelism: 3,
        rate: 20,
        period: 120,
      });

      // Verify it's pinned
      const pinned = await client.flowControl.get(flowControlKey);
      expect(pinned.isPinnedParallelism).toBe(true);
      expect(pinned.isPinnedRate).toBe(true);
      expect(pinned.parallelismMax).toBe(3);
      expect(pinned.rateMax).toBe(20);
      expect(pinned.ratePeriod).toBe(120);

      // Unpin the configuration
      await client.flowControl.unpin(flowControlKey, {
        parallelism: true,
        rate: true,
      });

      // Verify it's unpinned
      const unpinned = await client.flowControl.get(flowControlKey);
      expect(unpinned.isPinnedParallelism).toBe(false);
      expect(unpinned.isPinnedRate).toBe(false);

      // Clean up
      await client.messages.delete(messageId);
    },
    { timeout: 30_000 }
  );

  test(
    "should reset rate for a flow control key",
    async () => {
      const flowControlKey = `fc-reset-${Date.now()}`;
      // Publish a message with flow control to ensure the key exists
      const { messageId } = await client.publish({
        url: "https://mock.httpstatus.io/200?sleep=30000",
        body: "hello",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          rate: 10,
          period: "1m",
        },
      });

      // Reset the rate
      await client.flowControl.resetRate(flowControlKey);

      // Verify rate was reset by checking the flow control info
      const info = await client.flowControl.get(flowControlKey);
      expect(info.rateCount).toBe(0);

      // Clean up
      await client.messages.delete(messageId);
    },
    { timeout: 30_000 }
  );
});
