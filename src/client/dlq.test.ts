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
    await client.dlq.delete({ dlqIds: dlqLogs.messages.map((dlq) => dlq.dlqId) });
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

      await eventually(
        async () => {
          const result = await client.dlq.listMessages({
            filter: {
              messageId: message.messageId,
            },
          });

          expect(result.messages.length).toBe(1);
          expect(result.messages[0].messageId).toBe(message.messageId);
        },
        {
          timeout: 15_000,
          interval: 1000,
        }
      );

      const result = await client.dlq.listMessages({
        filter: {
          messageId: message.messageId,
        },
      });

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

      await eventually(
        async () => {
          const result = await client.dlq.listMessages({
            filter: {
              urlGroup: urlGroup,
            },
          });

          expect(result.messages.length).toBe(1);
          expect(result.messages[0].messageId).toBe(message[0].messageId);
        },
        {
          timeout: 15_000,
          interval: 1000,
        }
      );

      const result = await client.dlq.listMessages({
        filter: {
          urlGroup: urlGroup,
        },
      });

      await client.dlq.delete(result.messages[0].dlqId);
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

      let dlqMessage1: { dlqId: string; messageId: string } | undefined;
      let dlqMessage2: { dlqId: string; messageId: string } | undefined;
      let dlqMessage3: { dlqId: string; messageId: string } | undefined;

      // Wait for all messages to appear in DLQ
      await eventually(
        async () => {
          // Get all messages from DLQ
          const dlqLogs1 = await client.dlq.listMessages({
            filter: { messageId: message1.messageId },
          });
          const dlqLogs2 = await client.dlq.listMessages({
            filter: { messageId: message2.messageId },
          });
          const dlqLogs3 = await client.dlq.listMessages({
            filter: { messageId: message3.messageId },
          });

          dlqMessage1 = dlqLogs1.messages.find((dlq) => dlq.messageId === message1.messageId);
          dlqMessage2 = dlqLogs2.messages.find((dlq) => dlq.messageId === message2.messageId);
          dlqMessage3 = dlqLogs3.messages.find((dlq) => dlq.messageId === message3.messageId);

          expect(dlqMessage1).toBeDefined();
          expect(dlqMessage2).toBeDefined();
          expect(dlqMessage3).toBeDefined();
        },
        {
          timeout: 15_000,
          interval: 1000,
        }
      );

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

  test(
    "should delete multiple messages from DLQ using string array overload",
    async () => {
      const message1 = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`,
        retries: 0,
      });
      const message2 = await client.publish({
        url: `https://example.com/456/?asdasd=ooo`,
        retries: 0,
      });

      await sleep(10_000);

      const dlqLogs1 = await client.dlq.listMessages({ filter: { messageId: message1.messageId } });
      const dlqLogs2 = await client.dlq.listMessages({ filter: { messageId: message2.messageId } });

      const dlqMessage1 = dlqLogs1.messages.find((dlq) => dlq.messageId === message1.messageId);
      const dlqMessage2 = dlqLogs2.messages.find((dlq) => dlq.messageId === message2.messageId);

      expect(dlqMessage1).toBeDefined();
      expect(dlqMessage2).toBeDefined();

      // Delete using string[] overload
      const deleteResult = await client.dlq.delete([dlqMessage1!.dlqId, dlqMessage2!.dlqId]);

      expect(deleteResult).toBeDefined();
      expect(deleteResult.deleted).toBe(2);

      // Verify deletion
      const afterDelete1 = await client.dlq.listMessages({
        filter: { messageId: message1.messageId },
      });
      const afterDelete2 = await client.dlq.listMessages({
        filter: { messageId: message2.messageId },
      });

      expect(
        afterDelete1.messages.find((dlq) => dlq.messageId === message1.messageId)
      ).toBeUndefined();
      expect(
        afterDelete2.messages.find((dlq) => dlq.messageId === message2.messageId)
      ).toBeUndefined();
    },
    { timeout: 20_000 }
  );

  test(
    "should delete DLQ messages using filter overload",
    async () => {
      const label = `dlq-delete-filter-${Date.now()}`;
      await client.publish({
        url: `https://example.com/123/?asdasd=ooo`,
        retries: 0,
        label,
      });
      await client.publish({
        url: `https://example.com/456/?asdasd=ooo`,
        retries: 0,
        label,
      });

      await sleep(10_000);

      // Verify messages are in DLQ
      const dlqBefore = await client.dlq.listMessages({ filter: { label } });
      expect(dlqBefore.messages.length).toBeGreaterThanOrEqual(2);

      // Delete using filter overload
      const deleteResult = await client.dlq.delete({ label });

      expect(deleteResult).toBeDefined();
      expect(deleteResult.deleted).toBeGreaterThanOrEqual(2);

      // Verify deletion
      const dlqAfter = await client.dlq.listMessages({ filter: { label } });
      expect(dlqAfter.messages.length).toBe(0);
    },
    { timeout: 20_000 }
  );

  test(
    "should retry single DLQ message using string overload",
    async () => {
      const message = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`,
        retries: 0,
      });

      await sleep(10_000);

      const dlqLogs = await client.dlq.listMessages({ filter: { messageId: message.messageId } });
      const dlqMessage = dlqLogs.messages.find((dlq) => dlq.messageId === message.messageId);

      expect(dlqMessage).toBeDefined();

      // Retry using single string overload
      const retryResult = await client.dlq.retry(dlqMessage!.dlqId);

      expect(retryResult).toBeDefined();
      expect(retryResult.responses).toBeInstanceOf(Array);
      expect(retryResult.responses.length).toBe(1);
      expect(retryResult.responses[0].messageId).toBeDefined();

      await client.dlq.delete(dlqMessage!.dlqId);
    },
    { timeout: 20_000 }
  );

  test(
    "should retry DLQ messages using string array overload",
    async () => {
      const message1 = await client.publish({
        url: `https://example.com/123/?asdasd=ooo`,
        retries: 0,
      });
      const message2 = await client.publish({
        url: `https://example.com/456/?asdasd=ooo`,
        retries: 0,
      });

      await sleep(10_000);

      const dlqLogs1 = await client.dlq.listMessages({ filter: { messageId: message1.messageId } });
      const dlqLogs2 = await client.dlq.listMessages({ filter: { messageId: message2.messageId } });

      const dlqMessage1 = dlqLogs1.messages.find((dlq) => dlq.messageId === message1.messageId);
      const dlqMessage2 = dlqLogs2.messages.find((dlq) => dlq.messageId === message2.messageId);

      expect(dlqMessage1).toBeDefined();
      expect(dlqMessage2).toBeDefined();

      // Retry using string[] overload
      const retryResult = await client.dlq.retry([dlqMessage1!.dlqId, dlqMessage2!.dlqId]);

      expect(retryResult).toBeDefined();
      expect(retryResult.responses).toBeInstanceOf(Array);
      expect(retryResult.responses.length).toBe(2);
      expect(retryResult.responses.every((r) => r.messageId)).toBe(true);

      // Clean up
      await client.dlq.delete([dlqMessage1!.dlqId, dlqMessage2!.dlqId]);
    },
    { timeout: 20_000 }
  );

  test(
    "should retry DLQ messages using filter overload",
    async () => {
      const label = `dlq-retry-filter-${Date.now()}`;
      await client.publish({
        url: `https://example.com/123/?asdasd=ooo`,
        retries: 0,
        label,
      });
      await client.publish({
        url: `https://example.com/456/?asdasd=ooo`,
        retries: 0,
        label,
      });

      await sleep(10_000);

      // Verify messages are in DLQ
      const dlqBefore = await client.dlq.listMessages({ filter: { label } });
      expect(dlqBefore.messages.length).toBeGreaterThanOrEqual(2);

      // Retry using filter overload
      const retryResult = await client.dlq.retry({ label });

      expect(retryResult).toBeDefined();
      expect(retryResult.responses).toBeInstanceOf(Array);
      expect(retryResult.responses.length).toBeGreaterThanOrEqual(2);
      expect(retryResult.responses.every((r) => r.messageId)).toBe(true);

      // Clean up
      await client.dlq.delete({ label });
    },
    { timeout: 20_000 }
  );

  test("should return empty result when retry is called with an empty array", async () => {
    const result = await client.dlq.retry([]);
    expect(result).toEqual({ cursor: "", responses: [] });
  });

  test("should return empty result when delete is called with an empty array", async () => {
    const result = await client.dlq.delete([]);
    expect(result).toEqual({ deleted: 0 });
  });

  test("should return empty result when delete is called with { dlqIds: [] }", async () => {
    const result = await client.dlq.delete({ dlqIds: [] });
    expect(result).toEqual({ deleted: 0 });
  });
});
