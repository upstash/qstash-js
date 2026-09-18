/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer, expectToReject } from "./workflow/test-utils";
import { eventually } from "./test-utils";
import type { MessageCancelFilters } from "./filter-types";

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
   * Bulk cancel by filter (`host`, `path`, `label`, `flowControlKey`, ...) or
   * with `all: true` is answered from an events index that lags publish by a
   * few seconds, and the returned `cancelled` is only a snapshot of that index
   * taken when the request is accepted: it can be 0 while the matching
   * messages are still cancelled by the background worker moments later. So
   * instead of trusting the count, keep cancelling until every targeted
   * message is really gone, checked via `messages.get`, which reads the
   * primary store and is immediate. While the index is catching up a single
   * cancel call can itself block for 10-30s, hence the generous timeout.
   */
  const cancelUntilGone = async (request: MessageCancelFilters, goneIds: string[]) => {
    await eventually(
      async () => {
        await client.messages.cancel(request);
        for (const messageId of goneIds) {
          await expectToReject(() => client.messages.get(messageId), "not found");
        }
      },
      { timeout: 90_000, interval: 1000 }
    );
  };

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

      // The third message is matched by the label. Scoped by label so
      // concurrent test runs on the same account cannot interfere.
      await cancelUntilGone({ filter: { label } }, [messages[2].messageId]);
    },
    { timeout: 120_000 }
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

      // Cancel all messages with the specific flowControlKey: both of ours go...
      await cancelUntilGone({ filter: { flowControlKey } }, [
        message1.messageId,
        message2.messageId,
      ]);

      // ...and the one with a different key survives.
      const survivor = await client.messages.get(message3.messageId);
      expect(survivor.flowControlKey).toBe("different-flow-key");

      await client.messages.cancel(message3.messageId);
    },
    { timeout: 120_000 }
  );

  test(
    "should cancel all messages using all: true",
    async () => {
      const { messageId } = await client.publish({
        url: "https://httpbin.org/status/200",
        body: "hello",
        delay: "10d",
      });

      await cancelUntilGone({ all: true }, [messageId]);
    },
    { timeout: 120_000 }
  );

  test(
    "should cancel messages by multiple flowControlKeys (OR semantics)",
    async () => {
      const keyA = `cancel-multi-fc-a-${Date.now()}`;
      const keyB = `cancel-multi-fc-b-${Date.now()}`;
      const keyC = `cancel-multi-fc-c-${Date.now()}`;

      const ids: string[] = [];
      for (const key of [keyA, keyB, keyC]) {
        const { messageId } = await client.publish({
          url: "https://httpbin.org/status/200",
          body: "hello",
          delay: "10d",
          flowControl: { key, parallelism: 1 },
        });
        ids.push(messageId);
      }
      const [a, b, c] = ids;

      // Cancelling [A, B] should match the A and B messages but NOT C.
      await cancelUntilGone({ filter: { flowControlKey: [keyA, keyB] } }, [a, b]);

      // C survived...
      const survivor = await client.messages.get(c);
      expect(survivor.flowControlKey).toBe(keyC);

      // ...and can still be cancelled on its own.
      await cancelUntilGone({ filter: { flowControlKey: keyC } }, [c]);
    },
    { timeout: 200_000 }
  );

  test(
    "should cancel messages by destination path (single and multi-value)",
    async () => {
      const stamp = Date.now();
      const pathA = `/cancel-path-a-${stamp}`;
      const pathB = `/cancel-path-b-${stamp}`;
      const pathC = `/cancel-path-c-${stamp}`;

      const ids: string[] = [];
      for (const path of [pathA, pathB, pathC]) {
        const { messageId } = await client.publish({
          url: `https://example.com${path}`,
          body: "hello",
          delay: "10d",
        });
        ids.push(messageId);
      }
      const [a, b, c] = ids;

      // Unique paths make this deterministic: [A, B] cancels exactly A and B.
      await cancelUntilGone({ filter: { path: [pathA, pathB] } }, [a, b]);

      // C is untouched...
      const survivor = await client.messages.get(c);
      expect(survivor.url).toBe(`https://example.com${pathC}`);

      // ...and matched by its own path.
      await cancelUntilGone({ filter: { path: pathC } }, [c]);
    },
    { timeout: 200_000 }
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

      // Cancelling host example.org must not touch the example.com message.
      await cancelUntilGone({ filter: { host: "example.org" } }, [org.messageId]);

      // The example.com message survived...
      const survivor = await client.messages.get(com.messageId);
      expect(survivor.url).toBe(`https://example.com${comPath}`);

      // ...and is matched by its own path.
      await cancelUntilGone({ filter: { path: comPath } }, [com.messageId]);
    },
    { timeout: 200_000 }
  );

  // The server stopped applying `count` to DELETE /v2/messages when bulk cancel
  // became an asynchronous bulk action (qstash-server #1063, 2026-08-04). The
  // parameter is still accepted and still documented in the OpenAPI spec, and
  // DELETE /v2/dlq still honours it, so these assertions are kept as written
  // and skipped until the server either restores `count` or removes it from
  // the API contract. See upstash/qstash-js#270 for the investigation.
  test.skip(
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

  test.skip(
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
