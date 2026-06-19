/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "./workflow/test-utils";
import { eventually } from "./test-utils/eventually";

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
          timeout: 20_000,
          interval: 1000,
        }
      );
    },
    {
      timeout: 30_000,
    }
  );
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should round-trip multiple labels (label first, labels all)",
    async () => {
      const labelOne = `multi-a-${Date.now()}`;
      const labelTwo = `multi-b-${Date.now()}`;

      const { messageId } = await client.publish({
        url: "https://example.com",
        body: "log-multi-label-test",
        label: [labelOne, labelTwo],
      });

      await eventually(
        async () => {
          const result = await client.logs({ filter: { label: [labelOne, labelTwo] } });
          const log = result.logs.find((l) => l.messageId === messageId);
          expect(log).toBeDefined();
          // legacy `label` carries only the first label
          expect(log!.label).toBe(labelOne);
          // new `labels` carries all of them
          expect(log!.labels).toEqual([labelOne, labelTwo]);
        },
        { timeout: 20_000, interval: 1000 }
      );
    },
    { timeout: 30_000 }
  );

  test(
    "should filter logs by multiple labels (OR semantics)",
    async () => {
      const labelA = `or-a-${Date.now()}`;
      const labelB = `or-b-${Date.now()}`;
      const labelC = `or-c-${Date.now()}`;

      // msg1: [A, B], msg2: [B, C], msg3: [C]
      const { messageId: messageAB } = await client.publish({
        url: "https://example.com",
        body: "or-1",
        label: [labelA, labelB],
      });
      const { messageId: messageBC } = await client.publish({
        url: "https://example.com",
        body: "or-2",
        label: [labelB, labelC],
      });
      const { messageId: messageC } = await client.publish({
        url: "https://example.com",
        body: "or-3",
        label: labelC,
      });

      // filtering by [A, B] should match msgAB and msgBC (both share a label)
      // but NOT msgC.
      await eventually(
        async () => {
          const result = await client.logs({ filter: { label: [labelA, labelB] } });
          const ids = new Set(result.logs.map((l) => l.messageId));
          expect(ids.has(messageAB)).toBe(true);
          expect(ids.has(messageBC)).toBe(true);
          expect(ids.has(messageC)).toBe(false);
        },
        { timeout: 20_000, interval: 1000 }
      );
    },
    { timeout: 30_000 }
  );

  test("should use cursor", async () => {
    await client.logs({
      filter: {
        count: 1,
      },
    });
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

  test(
    "should return undefined cursor on last page, not empty string",
    async () => {
      const result = await client.logs({
        filter: {
          label: `non-existent-label-${Date.now()}`,
        },
      });

      expect(result.cursor).toBeUndefined();
    },
    { timeout: 30_000 }
  );
});

describe("logs - mocked filter url shape", () => {
  const token = "mock-token";

  test("should send a single label as a single query param", async () => {
    const client = new Client({ token, baseUrl: MOCK_QSTASH_SERVER_URL });
    await mockQStashServer({
      execute: async () => {
        await client.logs({ filter: { label: "label-1" } });
      },
      responseFields: { body: { events: [] }, status: 200 },
      receivesRequest: {
        method: "GET",
        token,
        url: `${MOCK_QSTASH_SERVER_URL}/v2/events?label=label-1`,
      },
      validateRequest: (request) => {
        expect(new URL(request.url).searchParams.getAll("label")).toEqual(["label-1"]);
      },
    });
  });

  test("should send multiple labels as repeated query params (OR semantics)", async () => {
    const client = new Client({ token, baseUrl: MOCK_QSTASH_SERVER_URL });
    await mockQStashServer({
      execute: async () => {
        await client.logs({ filter: { label: ["label-1", "label-2"] } });
      },
      responseFields: { body: { events: [] }, status: 200 },
      receivesRequest: {
        method: "GET",
        token,
        url: `${MOCK_QSTASH_SERVER_URL}/v2/events?label=label-1&label=label-2`,
      },
      validateRequest: (request) => {
        expect(new URL(request.url).searchParams.getAll("label")).toEqual(["label-1", "label-2"]);
      },
    });
  });
});

describe("events (deprecated)", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should use cursor", async () => {
    await client.events({
      filter: {
        count: 1,
      },
    });
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
