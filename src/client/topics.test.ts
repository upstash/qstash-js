/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";

describe("Topic", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should create a topic, check and delete it", async () => {
    const endpoint = { name: "topic1", url: "https://oz.requestcatcher.com" };
    await client.topics.addEndpoints({
      endpoints: [endpoint],
      name: "my-proxy-topic",
    });

    const topic = await client.topics.get("my-proxy-topic");
    await client.topics.delete("my-proxy-topic");
    expect(topic.endpoints).toContainEqual(endpoint);
  });

  test("should create a topic, and add one more endpoint then delete it", async () => {
    const endpoint = { name: "topic1", url: "https://oz.requestcatcher.com" };
    const endpoint1 = { name: "topic2", url: "https://oz1.requestcatcher.com" };

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
  });
});
