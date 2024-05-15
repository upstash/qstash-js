/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { nanoid } from "nanoid";
import { sleep } from "bun";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import type { MessageDetails } from "../../proxy-server/server";
import { Client } from "./client";

const DELAY = 2500;
const BASE_PROXY_SERVER_PATH = "https://cookie-jar-103-181-222-27.loca.lt";
const BASE_PROXY_SERVER_LOCAL_PATH = "http://localhost:4000";

async function fetchJSON<T>(url: string, sleepMs = DELAY): Promise<T> {
  await sleep(sleepMs);
  const response = await fetch(`${BASE_PROXY_SERVER_LOCAL_PATH}${url}`);
  if (!response.ok) {
    throw new Error(`Fetch failed with status: ${response.status}`);
  }
  const data = await response.json();
  return data as T;
}

describe("E2E Publish", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterEach(async () => {
    await sleep(DELAY);
  });
  test(
    "should publish a json message",
    async () => {
      const result = await client.publishJSON({
        url: `${BASE_PROXY_SERVER_PATH}/message`,
        body: { hello: "world" },
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
      });

      const proxyResult = await fetchJSON<MessageDetails>(
        `/publish-verify?messageId=${result.messageId}`,
        5000
      );
      expect(result.messageId).toBe(proxyResult.headers["upstash-message-id"] as string);
      expect(proxyResult.headers["test-header"]).toBe("test-value");
      expect(proxyResult.body).toEqual(JSON.stringify({ hello: "world" }));
    },
    { timeout: 15_000 }
  );

  test(
    "should publish a message with a delay",
    async () => {
      const result = await client.publish({
        url: `${BASE_PROXY_SERVER_PATH}/message`,
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        delay: 5,
      });

      const proxyResult = await fetchJSON<MessageDetails>(
        `/publish-verify?messageId=${result.messageId}`,
        10_000
      );
      expect(result.messageId).toBe(proxyResult.headers["upstash-message-id"] as string);
      expect(proxyResult.headers["test-header"]).toBe("test-value");
    },

    { timeout: 20_000 }
  );

  test(
    "should publish a message with a notBefore",
    async () => {
      const result = await client.publish({
        url: `${BASE_PROXY_SERVER_PATH}/message`,
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        notBefore: (Date.now() + 1000 * 5) / 1000,
      });

      const proxyResult = await fetchJSON<MessageDetails>(
        `/publish-verify?messageId=${result.messageId}`,
        10_000
      );
      expect(result.messageId).toBe(proxyResult.headers["upstash-message-id"] as string);
      expect(proxyResult.headers["test-header"]).toBe("test-value");
    },

    { timeout: 20_000 }
  );

  test(
    "should fail to publish a message with a notBefore due to not respecting delay",
    async () => {
      const result = await client.publish({
        url: `${BASE_PROXY_SERVER_PATH}/message`,
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        notBefore: (Date.now() + 1000 * 5) / 1000,
      });

      const proxyResult = await fetchJSON<MessageDetails>(
        `/publish-verify?messageId=${result.messageId}`
      );
      expect(proxyResult).toBeNull();
    },

    { timeout: 10_000 }
  );

  test(
    "should publish a message with a callback",
    async () => {
      const result = await client.publish({
        url: `${BASE_PROXY_SERVER_PATH}/message`,
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        callback: `${BASE_PROXY_SERVER_PATH}/message-callback`,
      });

      const proxyResult = await fetchJSON<MessageDetails>(
        `/publish-verify?messageId=${result.messageId}`,
        10_000
      );
      expect(result.messageId).toBe(proxyResult.callback!);
    },

    { timeout: 20_000 }
  );

  test(
    "should publish a message and fail then call failure callback",
    async () => {
      const retryCount = 1;

      const result = await client.publish({
        url: `${BASE_PROXY_SERVER_PATH}/failed-message`,
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        retries: retryCount, // Retries after 12 sec
        failureCallback: `${BASE_PROXY_SERVER_PATH}/failed-callback`,
      });

      const proxyResult = await fetchJSON<MessageDetails>(
        `/publish-verify?messageId=${result.messageId}`,
        25_000
      );
      expect(proxyResult.retryCount).toBeGreaterThanOrEqual(retryCount + 1);
    },

    { timeout: 35_000 }
  );
});

describe("E2E Topic Publish", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should publish message multiple topics",
    async () => {
      const endpoint = { name: "topic1", url: `${BASE_PROXY_SERVER_PATH}/topic1` };
      const endpoint1 = { name: "topic2", url: `${BASE_PROXY_SERVER_PATH}/topic2` };
      const topic = "my-proxy-topic";

      await client.topics.addEndpoints({
        endpoints: [endpoint, endpoint1],
        name: topic,
      });

      const result = await client.publish({
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        topic,
        delay: 3,
      });

      const json = await fetchJSON<MessageDetails[]>(
        `/publish-verify-multiple?messageId=${result[0].messageId}&messageId=${result[1].messageId}`,
        DELAY + 10_000
      );
      for (const messageDetail of json) {
        expect(messageDetail.headers["test-header"]).toEqual("test-value");
      }
      await client.topics.delete(topic);
    },
    { timeout: 15_000 }
  );
});

describe("E2E Queue", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterAll(async () => {
    const queueDetails = await client.queue().list();
    await Promise.all(
      queueDetails.map(async (q) => {
        await client.queue({ queueName: q.name }).delete();
      })
    );
  });

  test(
    "should create a queue, verify it then remove it",
    async () => {
      const queueName = nanoid();
      await client.queue({ queueName }).upsert({ parallelism: 1 });

      const queueDetails = await client.queue({ queueName }).enqueue({
        url: `${BASE_PROXY_SERVER_PATH}/message`,
        body: JSON.stringify({ hello: "world" }),
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
      });
      //Queue takes at least 20 sec to call an endpoint
      const json = await fetchJSON<MessageDetails>(
        `/publish-verify?messageId=${queueDetails.messageId}`,
        25_000
      );
      expect(json.headers["test-header"]).toEqual("test-value");
    },
    { timeout: 35_000 }
  );
});
