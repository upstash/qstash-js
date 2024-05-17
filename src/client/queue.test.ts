/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterAll, describe, expect, test } from "bun:test";
import { Client } from "./client";

describe("Queue", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterAll(async () => {
    const queueDetails = await client.queue().list();
    await Promise.all(
      queueDetails.map(async (q) => {
        await client.queue({ queueName: q.name }).delete();
      })
    );
  });

  test("should create a queue, verify it then remove it", async () => {
    const queueName = "upstash-queue";
    await client.queue({ queueName }).upsert({ parallelism: 2 });

    const queueDetails = await client.queue({ queueName }).get();
    expect(queueDetails.name).toEqual(queueName);

    await client.queue({ queueName }).delete();
  });

  test("should create multiple queue, verify them then remove them", async () => {
    const queueName1 = "upstash-queue1";
    const queueName2 = "upstash-queue2";

    await client.queue({ queueName: queueName1 }).upsert({ parallelism: 2 });
    await client.queue({ queueName: queueName2 }).upsert({ parallelism: 2 });

    const queueDetails = await client.queue().list();
    expect(queueDetails.map((q) => q.name).sort()).toEqual([queueName1, queueName2].sort());

    await client.queue({ queueName: queueName1 }).delete();
    await client.queue({ queueName: queueName2 }).delete();
  });
});
