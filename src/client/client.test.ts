/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { sleep } from "bun";
import { afterEach, describe, expect, test } from "bun:test";
import type { MessageDetails } from "../../proxy-server/server";
import { Client } from "./client";

const DELAY = 5000;

describe("Publish", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterEach(async () => {
    await sleep(DELAY);
  });
  test(
    "should publish a json message",
    async () => {
      const result = await client.publishJSON({
        url: "https://cookie-jar-103-181-222-27.loca.lt/message",
        body: { hello: "world" },
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
      });

      await sleep(DELAY);

      const proxy = await fetch(
        `http://localhost:4000/publish-verify?messageId=${result.messageId}`
      );
      const json = (await proxy.json()) as MessageDetails;

      expect(result.messageId).toBe(json.headers["upstash-message-id"] as string);
      expect(json.headers["test-header"]).toBe("test-value");
      expect(json.body).toEqual(JSON.stringify({ hello: "world" }));
    },
    { retry: 0, timeout: 15_000 }
  );

  test(
    "should publish a message with a delay",
    async () => {
      const result = await client.publish({
        url: "https://cookie-jar-103-181-222-27.loca.lt/message",
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        delay: 5,
      });

      await sleep(10_000);

      const proxy = await fetch(
        `http://localhost:4000/publish-verify?messageId=${result.messageId}`
      );
      const json = (await proxy.json()) as MessageDetails;
      expect(result.messageId).toBe(json.headers["upstash-message-id"] as string);
      expect(json.headers["test-header"]).toBe("test-value");
    },

    { retry: 0, timeout: 20_000 }
  );

  test(
    "should publish a message with a notBefore",
    async () => {
      const result = await client.publish({
        url: "https://cookie-jar-103-181-222-27.loca.lt/message",
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        notBefore: (Date.now() + 1000 * 5) / 1000,
      });

      await sleep(10_000);

      const proxy = await fetch(
        `http://localhost:4000/publish-verify?messageId=${result.messageId}`
      );
      const json = (await proxy.json()) as MessageDetails;
      expect(result.messageId).toBe(json.headers["upstash-message-id"] as string);
      expect(json.headers["test-header"]).toBe("test-value");
    },

    { retry: 0, timeout: 20_000 }
  );

  test(
    "should fail to publish a message with a notBefore due to not respecting delay",
    async () => {
      const result = await client.publish({
        url: "https://cookie-jar-103-181-222-27.loca.lt/message",
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        notBefore: (Date.now() + 1000 * 5) / 1000,
      });

      const proxy = await fetch(
        `http://localhost:4000/publish-verify?messageId=${result.messageId}`
      );
      const json = (await proxy.json()) as MessageDetails;
      expect(json).toBeNull();
    },

    { retry: 0, timeout: 10_000 }
  );

  test(
    "should publish a message with a callback",
    async () => {
      const result = await client.publish({
        url: "https://cookie-jar-103-181-222-27.loca.lt/message",
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        callback: "https://cookie-jar-103-181-222-27.loca.lt/message-callback",
      });

      await sleep(10_000);

      const proxy = await fetch(
        `http://localhost:4000/publish-verify?messageId=${result.messageId}`
      );
      const json = (await proxy.json()) as MessageDetails;

      expect(result.messageId).toBe(json.callback!);
    },

    { retry: 0, timeout: 20_000 }
  );

  test(
    "should publish a message and fail then call failure callback",
    async () => {
      const retryCount = 1;

      const result = await client.publish({
        url: "https://cookie-jar-103-181-222-27.loca.lt/failed-message",
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        retries: retryCount, // Retries after 12 sec
        failureCallback: "https://cookie-jar-103-181-222-27.loca.lt/failed-callback",
      });

      await sleep(25_000);

      const proxy = await fetch(
        `http://localhost:4000/publish-verify?messageId=${result.messageId}`
      );
      const json = (await proxy.json()) as MessageDetails;
      // We add one to retryCount because initial call makes it 1 so we call it 2 times
      expect(json.retryCount).toBeGreaterThanOrEqual(retryCount + 1);
    },

    { retry: 0, timeout: 35_000 }
  );
});

describe("Topic", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should create a topic, check and delete it",
    async () => {
      const endpoint = { name: "topic1", url: "https://cookie-jar-103-181-222-27.loca.lt/topic1" };
      await client.topics.addEndpoints({
        endpoints: [endpoint],
        name: "my-proxy-topic",
      });

      const topic = await client.topics.get("my-proxy-topic");
      await client.topics.delete("my-proxy-topic");
      expect(topic.endpoints).toContainEqual(endpoint);
    },
    { retry: 0, timeout: 15_000 }
  );

  test(
    "should create a topic, and add one more endpoint then delete it",
    async () => {
      const endpoint = { name: "topic1", url: "https://cookie-jar-103-181-222-27.loca.lt/topic1" };
      const endpoint1 = { name: "topic2", url: "https://cookie-jar-103-181-222-27.loca.lt/topic2" };

      await client.topics.addEndpoints({
        endpoints: [endpoint],
        name: "my-proxy-topic",
      });

      await client.topics.get("my-proxy-topic");
      await client.topics.addEndpoints({ name: "my-proxy-topic", endpoints: [endpoint1] });

      const list = await client.topics.list();
      await client.topics.delete("my-proxy-topic");

      expect(list[0].endpoints).toContainEqual(endpoint);
      expect(list[0].endpoints).toContainEqual(endpoint1);
    },
    { retry: 0, timeout: 15_000 }
  );

  test(
    "should publish message multiple topics",
    async () => {
      const endpoint = { name: "topic1", url: "https://cookie-jar-103-181-222-27.loca.lt/topic1" };
      const endpoint1 = { name: "topic2", url: "https://cookie-jar-103-181-222-27.loca.lt/topic2" };
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
      await sleep(10_000);
      expect(result).toBeArray();
    },
    { retry: 0, timeout: 25_000 }
  );
});
