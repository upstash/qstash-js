/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { beforeAll, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer, expectToReject } from "./workflow/test-utils";
import { eventually } from "./test-utils";
import type { State } from "./types";

// Updated to use constants for magic numbers
const SECONDS_IN_A_DAY = 24 * 60 * 60;

describe("Messages empty id guard", () => {
  test("should not send request when get is called with an empty string", async () => {
    await mockQStashServer({
      execute: async () => {
        const mockClient = new Client({
          token: "mock-token",
          baseUrl: MOCK_QSTASH_SERVER_URL,
        });
        await expectToReject(() => mockClient.messages.get(""), "Message id cannot be empty");
      },
      responseFields: { body: {}, status: 200 },
      receivesRequest: false,
    });
  });

  test("should throw a QstashError (not a TypeError) when get is called with undefined", async () => {
    await mockQStashServer({
      execute: async () => {
        const mockClient = new Client({
          token: "mock-token",
          baseUrl: MOCK_QSTASH_SERVER_URL,
        });
        // A JS consumer may accidentally pass a missing value; it should fail
        // with the intended "cannot be empty" error, not a TypeError.
        await expectToReject(
          () => mockClient.messages.get(undefined as unknown as string),
          "Message id cannot be empty"
        );
      },
      responseFields: { body: {}, status: 200 },
      receivesRequest: false,
    });
  });

  test("should not send request when cancel is called with an empty string", async () => {
    await mockQStashServer({
      execute: async () => {
        const mockClient = new Client({
          token: "mock-token",
          baseUrl: MOCK_QSTASH_SERVER_URL,
        });
        await expectToReject(() => mockClient.messages.cancel(""), "Message id cannot be empty");
      },
      responseFields: { body: {}, status: 200 },
      receivesRequest: false,
    });
  });

  test("should not send request when delete is called with an empty string", async () => {
    await mockQStashServer({
      execute: async () => {
        const mockClient = new Client({
          token: "mock-token",
          baseUrl: MOCK_QSTASH_SERVER_URL,
        });
        await expectToReject(
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          () => mockClient.messages.delete(""),
          "Message id cannot be empty"
        );
      },
      responseFields: { body: {}, status: 200 },
      receivesRequest: false,
    });
  });
});

describe("Messages", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  /**
   * Filter-based bulk cancel (`host`, `path`, `label`, ...) is served by the
   * events index, which is populated asynchronously a few seconds after a
   * message is published or cancelled. `messages.get(id)` sees the message
   * immediately, so it cannot be used to wait. Poll the logs until the
   * message reaches the given state before issuing a filter-based cancel.
   */
  const waitForLog = async (messageId: string, state: State) => {
    await eventually(
      async () => {
        const { logs } = await client.logs({ filter: { messageId, state } });
        expect(logs.length).toBeGreaterThan(0);
      },
      { timeout: 15_000, interval: 500 }
    );
  };

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
    "should cancel many by id and the rest by filter",
    async () => {
      const label = `cancel-many-${Date.now()}`;
      const messages = await client.batchJSON(
        [1, 2, 3].map((n) => ({
          url: `https://example.com`,
          body: { n },
          timeout: 90,
          delay: "10d",
          label,
        }))
      );

      expect(messages.length).toBe(3);

      const cancelled = await client.messages.cancel([
        messages[0].messageId,
        messages[1].messageId,
      ]);

      expect(cancelled.cancelled).toBe(2);

      // The label filter is answered from the events index: wait until it has
      // seen the two cancellations and the third message before relying on it.
      await Promise.all([
        waitForLog(messages[0].messageId, "CANCELED"),
        waitForLog(messages[1].messageId, "CANCELED"),
        waitForLog(messages[2].messageId, "CREATED"),
      ]);

      // Scoped by label so concurrent test runs on the same account cannot
      // change the count.
      const cancelledRest = await client.messages.cancel({ filter: { label } });
      expect(cancelledRest.cancelled).toBe(1);
    },
    { timeout: 30_000 }
  );

  test("should create message with flow control", async () => {
    const parallelism = 10;
    const ratePerSecond = 5;
    const period = "1d";
    const { messageId } = await client.publish({
      url: "https://mock.httpstatus.io/200?sleep=30000",
      body: "hello",
      delay: "10d",
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
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      await client.publish({
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      // Create a message with a different flow control key
      const message3 = await client.publish({
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
        flowControl: {
          key: "different-flow-key",
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      // Cancel all messages with the specific flowControlKey
      const result = await client.messages.cancel({ filter: { flowControlKey } });

      // Should cancel at least the 2 messages with the matching flowControlKey
      expect(result.cancelled).toBeGreaterThanOrEqual(2);

      await client.messages.cancel(message3.messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel all messages using all: true",
    async () => {
      await client.publish({
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
      });

      const cancelled = await client.messages.cancel({ all: true });

      expect(cancelled.cancelled).toBeGreaterThanOrEqual(1);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel messages by multiple flowControlKeys (OR semantics)",
    async () => {
      const keyA = `cancel-multi-fc-a-${Date.now()}`;
      const keyB = `cancel-multi-fc-b-${Date.now()}`;
      const keyC = `cancel-multi-fc-c-${Date.now()}`;

      for (const key of [keyA, keyB, keyC]) {
        await client.publish({
          url: "https://httpbin.org/status/200",
          body: "hello",
          delay: "10d",
          flowControl: { key, parallelism: 1 },
        });
      }

      // Cancelling [A, B] should match the A and B messages but NOT C.
      const result = await client.messages.cancel({
        filter: { flowControlKey: [keyA, keyB] },
      });
      expect(result.cancelled).toBe(2);

      // C survived and can still be cancelled on its own.
      const remaining = await client.messages.cancel({ filter: { flowControlKey: keyC } });
      expect(remaining.cancelled).toBe(1);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel messages by destination path (single and multi-value)",
    async () => {
      const stamp = Date.now();
      const pathA = `/cancel-path-a-${stamp}`;
      const pathB = `/cancel-path-b-${stamp}`;
      const pathC = `/cancel-path-c-${stamp}`;

      for (const path of [pathA, pathB, pathC]) {
        await client.publish({ url: `https://example.com${path}`, body: "hello", delay: "10d" });
      }

      // Unique paths make this deterministic: [A, B] cancels exactly two.
      const result = await client.messages.cancel({ filter: { path: [pathA, pathB] } });
      expect(result.cancelled).toBe(2);

      // C is untouched and matched by its own path.
      const remaining = await client.messages.cancel({ filter: { path: pathC } });
      expect(remaining.cancelled).toBe(1);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel messages by destination host (host discriminates)",
    async () => {
      const stamp = Date.now();
      const comPath = `/cancel-host-com-${stamp}`;
      const orgPath = `/cancel-host-org-${stamp}`;

      const com = await client.publish({
        url: `https://example.com${comPath}`,
        body: "hello",
        delay: "10d",
      });
      const org = await client.publish({
        url: `https://example.org${orgPath}`,
        body: "hello",
        delay: "10d",
      });

      // host/path filters are answered from the events index, which lags
      // publish by a few seconds. Cancelling before it catches up returns 0.
      await Promise.all([
        waitForLog(com.messageId, "CREATED"),
        waitForLog(org.messageId, "CREATED"),
      ]);

      // Cancelling host example.org must not touch the example.com message.
      const orgResult = await client.messages.cancel({ filter: { host: "example.org" } });
      expect(orgResult.cancelled).toBeGreaterThanOrEqual(1);

      // The example.com message survived — proven by cancelling it via its path.
      const comResult = await client.messages.cancel({ filter: { path: comPath } });
      expect(comResult.cancelled).toBe(1);
    },
    { timeout: 20_000 }
  );

  test(
    "should respect count: 1 with all: true",
    async () => {
      await client.batchJSON([
        { url: "https://httpbin.org/status/200", body: { n: 1 }, delay: "10d" },
        { url: "https://httpbin.org/status/200", body: { n: 2 }, delay: "10d" },
      ]);

      const result = await client.messages.cancel({ all: true, count: 1 });
      expect(result.cancelled).toBe(1);

      // clean up remaining
      await client.messages.cancel({ all: true });
    },
    { timeout: 20_000 }
  );

  test(
    "should respect count: 1 with filter",
    async () => {
      const label = `cancel-count-filter-${Date.now()}`;
      await client.batchJSON([
        { url: "https://httpbin.org/status/200", body: { n: 1 }, delay: "10d", label },
        { url: "https://httpbin.org/status/200", body: { n: 2 }, delay: "10d", label },
      ]);

      const result = await client.messages.cancel({ filter: { label }, count: 1 });
      expect(result.cancelled).toBe(1);

      // clean up remaining
      await client.messages.cancel({ filter: { label } });
    },
    { timeout: 20_000 }
  );

  test(
    "should return cancelled count when cancelling a single message",
    async () => {
      const message = await client.publish({
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
      });

      const result = await client.messages.cancel(message.messageId);

      expect(result).toBeDefined();
      expect(typeof result.cancelled).toBe("number");
      expect(result.cancelled).toBe(1);
    },
    { timeout: 20_000 }
  );
});
