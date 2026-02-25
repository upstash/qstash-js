/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { describe, expect, test } from "bun:test";
import { Client } from "./client";

describe("FlowControl", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  const flowControlKey = "test-flow-control-key";

  test(
    "should publish with flow control, then get flow control info",
    async () => {
      // Publish a message with flow control to ensure the key exists
      const { messageId } = await client.publish({
        url: "https://httpstat.us/200?sleep=30000",
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
});
