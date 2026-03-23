/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { clearQueues } from "./client.test";

describe("Queue", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterAll(async () => {
    await clearQueues(client);
  });

  beforeAll(async () => {
    await clearQueues(client);
  });

  test("should create a queue, verify it then remove it", async () => {
    const queueName = "upstash-queue";
    await client.queue({ queueName }).upsert({ parallelism: 2 });

    const queueDetails = await client.queue({ queueName }).get();
    expect(queueDetails.name).toEqual(queueName);

    await client.queue({ queueName }).delete();

    const queues = await client.queue().list();
    expect(queues.length).toBe(0);
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

  test("should pause/resume", async () => {
    const name = "upstash-pause-resume-queue";
    const queue = client.queue({ queueName: name });
    await queue.upsert({ parallelism: 1 });

    let queueInfo = await queue.get();
    expect(queueInfo.paused).toBeFalse();

    await queue.pause();

    queueInfo = await queue.get();
    expect(queueInfo.paused).toBeTrue();

    await queue.resume();

    queueInfo = await queue.get();
    expect(queueInfo.paused).toBeFalse();

    await queue.upsert({ paused: true });

    queueInfo = await queue.get();
    expect(queueInfo.paused).toBeTrue();

    await queue.upsert({ paused: false });

    queueInfo = await queue.get();
    expect(queueInfo.paused).toBeFalse();
  });
});
