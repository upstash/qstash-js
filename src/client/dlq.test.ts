/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { sleep } from "bun";
import { afterAll, describe, expect, test } from "bun:test";
import { Client } from "./client";

describe("DLQ", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterAll(async () => {
    const dlqLogs = await client.dlq.listMessages();
    await client.dlq.deleteMany({ dlqIds: dlqLogs.messages.map((dlq) => dlq.dlqId) });
  });

  test(
    "should force message to DLQ then check if items have a match",
    async () => {
      const message = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`, //Any broken link will work
        retries: 0,
      });

      await sleep(10_000);

      const dlqLogs = await client.dlq.listMessages();
      expect(dlqLogs.messages.map((dlq) => dlq.messageId)).toContain(message.messageId);
    },
    { timeout: 20_000 }
  );

  test(
    "should delete single dlq item",
    async () => {
      const message = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`, //Any broken link will work
        retries: 0,
      });

      await sleep(10_000);

      let dlqLogs = await client.dlq.listMessages();
      let dlqMessage = dlqLogs.messages.find((dlq) => dlq.messageId === message.messageId);

      await client.dlq.delete(dlqMessage?.dlqId ?? "");

      dlqLogs = await client.dlq.listMessages();
      dlqMessage = dlqLogs.messages.find((dlq) => dlq.messageId === message.messageId);

      expect(dlqMessage).toBeUndefined();
    },
    { timeout: 20_000 }
  );
});
