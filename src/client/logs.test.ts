/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "./workflow/test-utils";

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
        { interval: 1000 }
      );
    },
    { timeout: 10_000 }
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
        { interval: 1000 }
      );
    },
    { timeout: 15_000 }
  );

  test(
    "should filter logs by multiple urls (OR semantics)",
    async () => {
      const stamp = Date.now();
      const urlA = `https://example.com/log-url-a-${stamp}`;
      const urlB = `https://example.com/log-url-b-${stamp}`;
      const urlC = `https://example.com/log-url-c-${stamp}`;

      const { messageId: idA } = await client.publish({ url: urlA, body: "url-or-a" });
      const { messageId: idB } = await client.publish({ url: urlB, body: "url-or-b" });
      const { messageId: idC } = await client.publish({ url: urlC, body: "url-or-c" });

      // filtering by [A, B] should match A and B but NOT C.
      await eventually(
        async () => {
          const result = await client.logs({ filter: { url: [urlA, urlB] } });
          const ids = new Set(result.logs.map((l) => l.messageId));
          expect(ids.has(idA)).toBe(true);
          expect(ids.has(idB)).toBe(true);
          expect(ids.has(idC)).toBe(false);
        },
        { interval: 1000 }
      );
    },
    { timeout: 15_000 }
  );

  test(
    "should filter logs by destination host and path",
    async () => {
      const stamp = Date.now();
      const comPath = `/log-host-com-${stamp}`;
      const orgPath = `/log-host-org-${stamp}`;

      const { messageId: comId } = await client.publish({
        url: `https://example.com${comPath}`,
        body: "host-com",
      });
      const { messageId: orgId } = await client.publish({
        url: `https://example.org${orgPath}`,
        body: "host-org",
      });

      // host discriminates: filtering host example.org excludes the example.com message.
      await eventually(
        async () => {
          const byHost = await client.logs({ filter: { host: "example.org" } });
          const ids = new Set(byHost.logs.map((l) => l.messageId));
          expect(ids.has(orgId)).toBe(true);
          expect(ids.has(comId)).toBe(false);
        },
        { interval: 1000 }
      );

      // path discriminates: filtering the unique example.com path excludes the example.org message.
      await eventually(
        async () => {
          const byPath = await client.logs({ filter: { path: comPath } });
          const ids = new Set(byPath.logs.map((l) => l.messageId));
          expect(ids.has(comId)).toBe(true);
          expect(ids.has(orgId)).toBe(false);
        },
        { interval: 1000 }
      );
    },
    { timeout: 15_000 }
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
    { timeout: 10_000 }
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

  test("should send multi-value url and host/path filters as repeated query params", async () => {
    const client = new Client({ token, baseUrl: MOCK_QSTASH_SERVER_URL });
    await mockQStashServer({
      execute: async () => {
        await client.logs({
          filter: {
            url: ["https://a.com", "https://b.com"],
            host: ["a.com", "b.com"],
            path: "/webhook",
          },
        });
      },
      responseFields: { body: { events: [] }, status: 200 },
      receivesRequest: {
        method: "GET",
        token,
        url: `${MOCK_QSTASH_SERVER_URL}/v2/events?url=${encodeURIComponent("https://a.com")}&url=${encodeURIComponent("https://b.com")}&host=a.com&host=b.com&path=%2Fwebhook`,
      },
      validateRequest: (request) => {
        const params = new URL(request.url).searchParams;
        expect(params.getAll("url")).toEqual(["https://a.com", "https://b.com"]);
        expect(params.getAll("host")).toEqual(["a.com", "b.com"]);
        expect(params.getAll("path")).toEqual(["/webhook"]);
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
