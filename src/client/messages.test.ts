/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { beforeAll, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { QstashError } from "./error";
import { eventually } from "./test-utils";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer, expectToReject } from "./workflow/test-utils";

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

  const expectMessagesCancelled = async (messages: { messageId: string }[]) => {
    await eventually(
      async () => {
        for (const { messageId } of messages) {
          const result: unknown = await client.messages
            .get(messageId)
            .catch((error: unknown) => error);
          expect(result).toBeInstanceOf(QstashError);
          expect(result).toMatchObject({ status: 404 });
        }
      },
      { timeout: 10_000, interval: 500 }
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
    "should cancel many and all",
    async () => {
      const messages = await client.batchJSON([
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: 10,
        },
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: 10,
        },
        {
          url: `https://example.com`,
          body: { hello: "world" },
          timeout: 90,
          delay: "10d",
        },
      ]);

      expect(messages.length).toBe(3);

      const cancelled = await client.messages.cancel([
        messages[0].messageId,
        messages[1].messageId,
      ]);

      expect(cancelled.cancelled).toBe(2);

      await client.messages.cancel({ all: true });
      await expectMessagesCancelled(messages);
    },
    { timeout: 20_000 }
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
      const flowControlKey = `cancel-flow-${Date.now()}`;
      // Create messages with the same flow control key
      const message1 = await client.publish({
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
        flowControl: {
          key: flowControlKey,
          parallelism: 5,
          ratePerSecond: 10,
        },
      });

      const message2 = await client.publish({
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
      await client.messages.cancel({ filter: { flowControlKey } });
      await expectMessagesCancelled([message1, message2]);
      expect(await client.messages.get(message3.messageId)).toMatchObject({
        messageId: message3.messageId,
      });
      await client.messages.cancel(message3.messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel all messages using all: true",
    async () => {
      const message = await client.publish({
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
      });

      await client.messages.cancel({ all: true });
      await expectMessagesCancelled([message]);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel messages by multiple flowControlKeys (OR semantics)",
    async () => {
      const keyA = `cancel-multi-fc-a-${Date.now()}`;
      const keyB = `cancel-multi-fc-b-${Date.now()}`;
      const keyC = `cancel-multi-fc-c-${Date.now()}`;

      const messages = await client.batchJSON(
        [keyA, keyB, keyC].map((key) => ({
          url: "https://httpbin.org/status/200",
          body: "hello",
          delay: "10d",
          flowControl: { key, parallelism: 1 },
        }))
      );

      await client.messages.cancel({ filter: { flowControlKey: [keyA, keyB] } });
      await expectMessagesCancelled(messages.slice(0, 2));
      expect(await client.messages.get(messages[2].messageId)).toMatchObject({
        messageId: messages[2].messageId,
      });

      await client.messages.cancel({ filter: { flowControlKey: keyC } });
      await expectMessagesCancelled([messages[2]]);
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

      const messages = await client.batchJSON(
        [pathA, pathB, pathC].map((path) => ({
          url: `https://example.com${path}`,
          body: "hello",
          delay: "10d",
        }))
      );

      await client.messages.cancel({ filter: { path: [pathA, pathB] } });
      await expectMessagesCancelled(messages.slice(0, 2));
      expect(await client.messages.get(messages[2].messageId)).toMatchObject({
        messageId: messages[2].messageId,
      });

      await client.messages.cancel({ filter: { path: pathC } });
      await expectMessagesCancelled([messages[2]]);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel messages by destination host (host discriminates)",
    async () => {
      const stamp = Date.now();
      const comPath = `/cancel-host-com-${stamp}`;
      const orgPath = `/cancel-host-org-${stamp}`;

      const comMessage = await client.publish({
        url: `https://example.com${comPath}`,
        body: "hello",
        delay: "10d",
      });
      const orgMessage = await client.publish({
        url: `https://example.org${orgPath}`,
        body: "hello",
        delay: "10d",
      });

      await client.messages.cancel({ filter: { host: "example.org" } });
      await expectMessagesCancelled([orgMessage]);
      expect(await client.messages.get(comMessage.messageId)).toMatchObject({
        messageId: comMessage.messageId,
      });

      await client.messages.cancel({ filter: { path: comPath } });
      await expectMessagesCancelled([comMessage]);
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel all pending messages even when legacy count is set",
    async () => {
      const messages = await client.batchJSON([
        { url: "https://httpbin.org/status/200", body: { n: 1 }, delay: "10d" },
        { url: "https://httpbin.org/status/200", body: { n: 2 }, delay: "10d" },
      ]);

      try {
        // Kept intentionally to cover callers compiled against the old API.
        const result = await client.messages.cancel({ all: true, count: 1 });
        expect(Number.isInteger(result.cancelled)).toBe(true);
        expect(result.cancelled).toBeGreaterThanOrEqual(0);
        await expectMessagesCancelled(messages);
      } finally {
        await client.messages.cancel(messages.map(({ messageId }) => messageId));
      }
    },
    { timeout: 20_000 }
  );

  test(
    "should cancel every matching message and preserve others even when legacy count is set",
    async () => {
      const label = `cancel-count-filter-${Date.now()}`;
      const messages = await client.batchJSON([
        { url: "https://httpbin.org/status/200", body: { n: 1 }, delay: "10d", label },
        { url: "https://httpbin.org/status/200", body: { n: 2 }, delay: "10d", label },
        {
          url: "https://httpbin.org/status/200",
          body: { n: 3 },
          delay: "10d",
          label: `${label}-other`,
        },
      ]);

      try {
        // The snapshot count is not proof of cancellation. Inspect each fixture.
        const result = await client.messages.cancel({ filter: { label }, count: 1 });
        expect(Number.isInteger(result.cancelled)).toBe(true);
        expect(result.cancelled).toBeGreaterThanOrEqual(0);
        await expectMessagesCancelled(messages.slice(0, 2));
        expect(await client.messages.get(messages[2].messageId)).toMatchObject({
          messageId: messages[2].messageId,
        });
      } finally {
        await client.messages.cancel(messages.map(({ messageId }) => messageId));
      }
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
