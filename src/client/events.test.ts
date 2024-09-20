/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {  describe, expect, test } from "bun:test";
import { Client } from "./client";
import { parseCursor } from "./utils";

describe("events", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should use cursor", async () => {
	const result1 = await client.events()

	const result2 = await client.events({ cursor: result1.cursor })


	if (result1.cursor && result2.cursor) {
		expect(parseCursor(result1.cursor).timestamp).toBeGreaterThan(parseCursor(result2.cursor).timestamp);
	}

  })
});
