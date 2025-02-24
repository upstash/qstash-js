/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { parseCursor } from "./utils";

describe("logs", () => {
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
