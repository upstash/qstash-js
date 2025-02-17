/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { parseCursor } from "./utils";

describe("logs", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should use cursor", async () => {
    const result1 = await client.logs();

    const result2 = await client.logs({ cursor: result1.cursor });

    if (result1.cursor && result2.cursor) {
      expect(parseCursor(result1.cursor).timestamp).toBeGreaterThan(
        parseCursor(result2.cursor).timestamp
      );
    }
  });

  test("should have both events and logs fields", async () => {
    const result = await client.logs();

    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("logs");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(result.events).toEqual(result.logs);
  });

  test("the old events field should still work", async () => {
    const result = await client.events();

    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("logs");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(result.events).toEqual(result.logs);

    const result2 = await client.events({ cursor: result.cursor });

    if (result.cursor && result2.cursor) {
      expect(parseCursor(result.cursor).timestamp).toBeGreaterThan(
        parseCursor(result2.cursor).timestamp
      );
    }
  });
});
