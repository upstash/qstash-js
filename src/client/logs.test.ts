/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { parseCursor } from "./utils";

describe("logs", () => {
  test(
    "should filter logs by label",
    async () => {
      const label = `label-${Date.now()}`;
      await client.publish({ url: "https://example.com", body: "log-label-test", label });
      // Wait for log to be available

      await eventually(
        async () => {
          const result = await client.logs({
            filter: {
              label,
            },
          });
          expect(result.logs.length).toBeGreaterThan(0);
          expect(result.logs[0].label).toBe(label);
        },
        {
          interval: 1000,
        }
      );
    },
    {
      timeout: 10_000,
    }
  );
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should use cursor", async () => {
    const result1 = await client.logs({
      filter: {
        count: 1,
      },
    });

    const result2 = await client.logs({
      cursor: result1.cursor,
      filter: {
        count: 1,
      },
    });

    if (result1.cursor && result2.cursor) {
      expect(parseCursor(result1.cursor).timestamp).toBeGreaterThan(
        parseCursor(result2.cursor).timestamp
      );
    }
  });

  test("should have the logs field in the response", async () => {
    const result = await client.logs({
      filter: {
        count: 1,
      },
    });

    expect(result.logs).toBeDefined();
    expect(Array.isArray(result.logs)).toBe(true);
  });
});

describe("events (deprecated)", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should use cursor", async () => {
    const result1 = await client.events({
      filter: {
        count: 1,
      },
    });

    const result2 = await client.events({
      cursor: result1.cursor,
      filter: {
        count: 1,
      },
    });

    if (result1.cursor && result2.cursor) {
      expect(parseCursor(result1.cursor).timestamp).toBeGreaterThan(
        parseCursor(result2.cursor).timestamp
      );
    }
  });

  test("should have the events field in the response", async () => {
    const result = await client.events({
      filter: {
        count: 1,
      },
    });

    expect(result.events).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
  });
});

const EVENTUALLY_TIMEOUT = 5000;

export const eventually = async function (
  function_: () => Promise<void> | void,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> {
  const { timeout = EVENTUALLY_TIMEOUT, interval = 100 } = options;

  const startTime = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      await function_();
      // Success case - all assertions passed
      return;
    } catch (error) {
      const lastError = error as Error;
      if (Date.now() - startTime >= timeout) {
        throw new Error(`Assertions not satisfied within timeout: ${lastError.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
};
