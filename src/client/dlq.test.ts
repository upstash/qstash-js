/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-deprecated */
import { sleep } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { eventually } from "./logs.test";

// Updated to use constants for magic numbers
const SECONDS_IN_A_DAY = 24 * 60 * 60;

describe("DLQ", () => {
  test(
    "should filter DLQ messages by label",
    async () => {
      const label = `dlq-label-${Date.now()}`;
      await client.publish({
        url: "https://example.com/force-dlq",
        retries: 0,
        label,
      });
      await sleep(10_000);
      const dlqLogs = await client.dlq.listMessages({ filter: { label } });
      expect(dlqLogs.messages.some((m) => m.label === label)).toBe(true);
    },
    {
      timeout: 15_000,
    }
  );
  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  const urlGroup = "someUrlGroup";

  beforeAll(async () => {
    await client.urlGroups.addEndpoints({
      name: urlGroup,
      endpoints: [
        {
          name: "myEndpoint",
          url: "https://example.com/789/?asdasd=ooo",
        },
      ],
    });
  });

  afterAll(async () => {
    await client.urlGroups.delete(urlGroup);

    const dlqLogs = await client.dlq.listMessages();
    if (dlqLogs.messages.length === 0) return;
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

      const dlqLogs = await client.dlq.listMessages({ filter: { messageId: message.messageId } });
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

      let dlqLogs = await client.dlq.listMessages({ filter: { messageId: message.messageId } });
      let dlqMessage = dlqLogs.messages.find((dlq) => dlq.messageId === message.messageId);

      await client.dlq.delete(dlqMessage?.dlqId ?? "");

      dlqLogs = await client.dlq.listMessages({ filter: { messageId: message.messageId } });
      dlqMessage = dlqLogs.messages.find((dlq) => dlq.messageId === message.messageId);

      expect(dlqMessage).toBeUndefined();
    },
    { timeout: 20_000 }
  );

  test(
    "should filter requests",
    async () => {
      const message = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`, //Any broken link will work
        retries: 0,
      });

      await sleep(10_000);

      const result = await client.dlq.listMessages({
        filter: {
          messageId: message.messageId,
        },
      });

      expect(result.messages.length).toBe(1);
      expect(result.messages[0].messageId).toBe(message.messageId);

      await client.dlq.delete(result.messages[0].dlqId);
    },
    { timeout: 20_000 }
  );

  test(
    "should filter requests with urlGroup",
    async () => {
      /**
       * we pass both urlGroup and topicName in our request, which could
       * fail in the backend. Adding this test to make sure that
       */
      const message = await client.publish({
        urlGroup: urlGroup,
        retries: 0,
      });

      await eventually(async () => {
        const result = await client.dlq.listMessages({
          filter: {
            urlGroup: urlGroup,
          },
        });

        expect(result.messages.length).toBe(1);
        expect(result.messages[0].messageId).toBe(message[0].messageId);
        await client.dlq.delete(result.messages[0].dlqId);
      });
    },
    { timeout: 20_000 }
  );

  test(
    "should get flow control",
    async () => {
      const parallelism = 10;
      const ratePerSecond = 5;
      const retryDelay = "2000 * retried";
      const randomKey = `flow-control-key-${Date.now()}`;
      const { messageId } = await client.publish({
        url: "https://httpstat.us/400",
        body: "hello",
        retries: 0,
        flowControl: {
          key: randomKey,
          parallelism,
          ratePerSecond,
          period: "1d",
        },
        retryDelay,
      });

      await eventually(async () => {
        const result = await client.dlq.listMessages({
          filter: {
            messageId,
          },
        });
        expect(result.messages.length).toBe(1);
        const message = result.messages[0];

        expect(message.flowControlKey).toBe(randomKey);
        expect(message.parallelism).toBe(parallelism);
        expect(message.ratePerSecond).toBe(ratePerSecond);
        expect(message.rate).toBe(ratePerSecond);
        expect(message.period).toBe(SECONDS_IN_A_DAY);
        expect(message.retryDelayExpression).toBe(retryDelay);
      });
    },
    {
      timeout: 10_000,
    }
  );

  test(
    "should filter DLQ messages by label",
    async () => {
      const testLabel = `dlq-test-label-${Date.now()}`;
      await client.publish({
        url: `https://httpstat.us/400`, // Any broken link will work
        retries: 0,
        label: testLabel,
      });

      await sleep(4000);

      const dlqLogs = await client.dlq.listMessages({
        filter: {
          label: testLabel,
        },
      });

      expect(dlqLogs.messages.length).toBeGreaterThanOrEqual(1);
      for (const message of dlqLogs.messages) {
        if (message.label !== undefined) {
          expect(message.label).toBe(testLabel);
        }
      }
    },
    { timeout: 20_000 }
  );

  test(
    "should retry multiple messages from DLQ",
    async () => {
      // Publish multiple messages that will fail
      const message1 = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`,
        retries: 0,
      });
      const message2 = await client.publish({
        url: `https://example.com/456/?asdasd=ooo`,
        retries: 0,
      });
      const message3 = await client.publish({
        url: `https://example.com/789/?asdasd=ooo`,
        retries: 0,
      });

      await sleep(10_000);

      // Get all messages from DLQ
      const dlqLogs1 = await client.dlq.listMessages({ filter: { messageId: message1.messageId } });
      const dlqLogs2 = await client.dlq.listMessages({ filter: { messageId: message2.messageId } });
      const dlqLogs3 = await client.dlq.listMessages({ filter: { messageId: message3.messageId } });

      const dlqMessage1 = dlqLogs1.messages.find((dlq) => dlq.messageId === message1.messageId);
      const dlqMessage2 = dlqLogs2.messages.find((dlq) => dlq.messageId === message2.messageId);
      const dlqMessage3 = dlqLogs3.messages.find((dlq) => dlq.messageId === message3.messageId);

      expect(dlqMessage1).toBeDefined();
      expect(dlqMessage2).toBeDefined();
      expect(dlqMessage3).toBeDefined();

      // Retry all three messages
      const dlqIds = [dlqMessage1!.dlqId, dlqMessage2!.dlqId, dlqMessage3!.dlqId];

      const retryResult = await client.dlq.retry({ dlqIds });

      // Verify the response contains messageIds
      expect(retryResult).toBeDefined();
      expect(retryResult.responses).toBeInstanceOf(Array);
      expect(retryResult.responses.length).toBe(3);
      expect(retryResult.responses.every((result) => result.messageId)).toBe(true);

      // Clean up - delete the retried messages from DLQ
      await client.dlq.deleteMany({ dlqIds });
    },
    { timeout: 20_000 }
  );

  test(
    "should delete multiple messages from DLQ",
    async () => {
      // Publish multiple messages that will fail
      const message1 = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`,
        retries: 0,
      });
      const message2 = await client.publish({
        url: `https://example.com/456/?asdasd=ooo`,
        retries: 0,
      });
      const message3 = await client.publish({
        url: `https://example.com/789/?asdasd=ooo`,
        retries: 0,
      });

      await sleep(10_000);

      // Get all messages from DLQ
      const dlqLogs1 = await client.dlq.listMessages({ filter: { messageId: message1.messageId } });
      const dlqLogs2 = await client.dlq.listMessages({ filter: { messageId: message2.messageId } });
      const dlqLogs3 = await client.dlq.listMessages({ filter: { messageId: message3.messageId } });

      const dlqMessage1 = dlqLogs1.messages.find((dlq) => dlq.messageId === message1.messageId);
      const dlqMessage2 = dlqLogs2.messages.find((dlq) => dlq.messageId === message2.messageId);
      const dlqMessage3 = dlqLogs3.messages.find((dlq) => dlq.messageId === message3.messageId);

      expect(dlqMessage1).toBeDefined();
      expect(dlqMessage2).toBeDefined();
      expect(dlqMessage3).toBeDefined();

      // Delete all three messages
      const dlqIds = [dlqMessage1!.dlqId, dlqMessage2!.dlqId, dlqMessage3!.dlqId];

      const deleteResult = await client.dlq.deleteMany({ dlqIds });

      // Verify the response contains the correct deleted count
      expect(deleteResult).toBeDefined();
      expect(deleteResult.deleted).toBe(3);

      // Verify the messages are actually deleted from DLQ
      const dlqLogsAfterDelete1 = await client.dlq.listMessages({
        filter: { messageId: message1.messageId },
      });
      const dlqLogsAfterDelete2 = await client.dlq.listMessages({
        filter: { messageId: message2.messageId },
      });
      const dlqLogsAfterDelete3 = await client.dlq.listMessages({
        filter: { messageId: message3.messageId },
      });

      const dlqMessageAfterDelete1 = dlqLogsAfterDelete1.messages.find(
        (dlq) => dlq.messageId === message1.messageId
      );
      const dlqMessageAfterDelete2 = dlqLogsAfterDelete2.messages.find(
        (dlq) => dlq.messageId === message2.messageId
      );
      const dlqMessageAfterDelete3 = dlqLogsAfterDelete3.messages.find(
        (dlq) => dlq.messageId === message3.messageId
      );

      expect(dlqMessageAfterDelete1).toBeUndefined();
      expect(dlqMessageAfterDelete2).toBeUndefined();
      expect(dlqMessageAfterDelete3).toBeUndefined();
    },
    { timeout: 20_000 }
  );
});
