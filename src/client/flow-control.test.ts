/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { afterAll, describe, expect, test } from "bun:test";
import { Client } from "./client";

describe("FlowControl", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  const flowControlKey = "test-flow-control-key";

  afterAll(async () => {
    // Clean up: reset the flow control key used in tests
    try {
      await client.flowControl.reset(flowControlKey);
    } catch {
      // Ignore errors during cleanup
    }
  });

  test(
    "should publish with flow control, then list and get flow control info",
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

      // List all flow controls and verify our key is present
      const flowControls = await client.flowControl.list();
      expect(Array.isArray(flowControls)).toBe(true);

      const found = flowControls.find((fc) => fc.flowControlKey === flowControlKey);
      expect(found).toBeDefined();
      expect(found!.flowControlKey).toBe(flowControlKey);
      expect(typeof found!.waitListSize).toBe("number");
      expect(typeof found!.parallelismMax).toBe("number");
      expect(typeof found!.parallelismCount).toBe("number");
      expect(typeof found!.rateMax).toBe("number");
      expect(typeof found!.rateCount).toBe("number");
      expect(typeof found!.ratePeriod).toBe("number");
      expect(typeof found!.ratePeriodStart).toBe("number");

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
    "should list flow controls with search filter",
    async () => {
      const flowControls = await client.flowControl.list({ search: flowControlKey });
      expect(Array.isArray(flowControls)).toBe(true);

      for (const fc of flowControls) {
        expect(fc.flowControlKey).toContain(flowControlKey);
      }
    },
    { timeout: 20_000 }
  );

  test(
    "should reset flow control",
    async () => {
      // Reset should not throw
      await client.flowControl.reset(flowControlKey);

      // After reset, get should still work (counters are zeroed)
      const fc = await client.flowControl.get(flowControlKey);
      expect(fc.flowControlKey).toBe(flowControlKey);
      expect(fc.parallelismCount).toBe(0);
      expect(fc.rateCount).toBe(0);
    },
    { timeout: 20_000 }
  );
});
