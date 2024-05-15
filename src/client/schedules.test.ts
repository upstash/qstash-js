/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { sleep } from "bun";
import type { Schedule } from "./schedules";

describe("Schedules", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should schedule a message then verify it",
    async () => {
      const { scheduleId } = await client.schedules.create({
        destination: `https://oz.requestcatcher.com/`,
        body: JSON.stringify({ hello: "world" }),
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
        method: "GET",
        callback: "https://example.com",
        failureCallback: "https://example.com/failure",
        delay: 10,
        retries: 5,
        cron: "*/10 * * * * ",
      });

      await sleep(5000);

      const scheduledMessage = await client.schedules.get(scheduleId);
      expect(scheduledMessage).toEqual(
        expect.objectContaining({
          cron: "*/10 * * * *",
          destination: "https://oz.requestcatcher.com/",
          method: "GET",
          header: {
            "Bypass-Tunnel-Reminder": ["client-test"],
            "Content-Type": ["application/json"],
            "Test-Header": ["test-value"],
          },
          body: '{"hello":"world"}',
          retries: 5,
          delay: 10,
          callback: "https://example.com",
          failureCallback: "https://example.com/failure",
        }) as Schedule
      );

      await client.schedules.delete(scheduleId);
    },
    { timeout: 10_000 }
  );

  test(
    "should schedule multiple messages then list them",
    async () => {
      const { scheduleId: scheduleId1 } = await client.schedules.create({
        destination: `https://oz.requestcatcher.com/`,
        cron: "*/10 * * * * ",
      });
      const { scheduleId: scheduleId2 } = await client.schedules.create({
        destination: `https://oz1.requestcatcher.com/`,
        cron: "*/10 * * * * ",
      });

      await sleep(5000);

      const scheduledMessage = await client.schedules.list();
      await Promise.all([
        client.schedules.delete(scheduleId1),
        client.schedules.delete(scheduleId2),
      ]);
      await sleep(2500);

      expect(scheduledMessage.map((message) => message.scheduleId)).toEqual([
        scheduleId1,
        scheduleId2,
      ]);
    },
    { timeout: 15_000 }
  );
});
