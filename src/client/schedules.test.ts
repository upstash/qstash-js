/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-deprecated */
import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import type { Schedule } from "./schedules";
import { nanoid } from "nanoid";
import { MOCK_QSTASH_SERVER_URL, MOCK_SERVER_URL, mockQStashServer } from "./workflow/test-utils";

// Updated to use constants for magic numbers
const SECONDS_IN_A_DAY = 24 * 60 * 60;

describe("Schedules", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterEach(async () => {
    const scheduleDetails = await client.schedules.list();
    await Promise.all(
      scheduleDetails.map(async (s) => {
        await client.schedules.delete(s.scheduleId);
      })
    );
  });

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
        queueName: "scheduleQueue",
        cron: "*/10 * * * * ",
      });

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
          queueName: "scheduleQueue",
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

      const scheduledMessage = await client.schedules.list();

      expect(scheduledMessage.map((message) => message.scheduleId).sort()).toEqual(
        [scheduleId1, scheduleId2].sort()
      );
    },
    { timeout: 15_000 }
  );

  test("should pause/resume", async () => {
    const createResult = await client.schedules.create({
      cron: "1 1 1 1 1",
      destination: "https://example.com",
      body: JSON.stringify({ ex_key: "ex_value" }),
    });

    expect(createResult).toBeTruthy();

    let getResult = await client.schedules.get(createResult.scheduleId);

    expect(getResult.scheduleId).toBe(createResult.scheduleId);
    expect(getResult.cron).toBe("1 1 1 1 1");
    expect(getResult.isPaused).toBeFalse();

    await client.schedules.pause({ schedule: createResult.scheduleId });

    getResult = await client.schedules.get(createResult.scheduleId);
    expect(getResult.isPaused).toBeTrue();

    await client.schedules.resume({ schedule: createResult.scheduleId });

    getResult = await client.schedules.get(createResult.scheduleId);
    expect(getResult.isPaused).toBeFalse();
  });

  test("should be able to edit existing schedule", async () => {
    const scheduleId = nanoid();
    const initialDestination = "https://www.initial.com";
    const updatedDestination = "https://www.updated.com";

    let schedules = await client.schedules.list();
    expect(schedules.length).toBe(0);

    await client.schedules.create({
      destination: initialDestination,
      cron: "*/5 * * * *",
      scheduleId,
      body: "my-payload",
    });
    schedules = await client.schedules.list();
    expect(schedules.length).toBe(1);
    expect(schedules[0].scheduleId).toBe(scheduleId);
    expect(schedules[0].destination).toBe(initialDestination);

    await client.schedules.create({
      destination: updatedDestination,
      cron: "*/5 * * * *",
      scheduleId,
    });
    schedules = await client.schedules.list();
    expect(schedules.length).toBe(1);
    expect(schedules[0].scheduleId).toBe(scheduleId);
    expect(schedules[0].destination).toBe(updatedDestination);
    expect(schedules[0].body).toBeUndefined();
  });

  test("should be able to schedule with correct headers", async () => {
    const qstashToken = nanoid();

    const globalHeader = "global-header";
    const globalHeaderOverwritten = "global-header-overwritten";
    const requestHeader = "request-header";

    const globalHeaderValue = nanoid();
    const overWrittenOldValue = nanoid();
    const overWrittenNewValue = nanoid();
    const requestHeaderValue = nanoid();

    const client = new Client({
      baseUrl: MOCK_QSTASH_SERVER_URL,
      token: qstashToken,
      headers: {
        [globalHeader]: globalHeaderValue,
        [globalHeaderOverwritten]: overWrittenOldValue,
      },
    });
    await mockQStashServer({
      execute: async () => {
        await client.schedules.create({
          scheduleId: "asd",
          destination: MOCK_SERVER_URL,
          cron: "* * * * 1",
          body: JSON.stringify([
            {
              from: "Acme <onboarding@resend.dev>",
              to: ["foo@gmail.com"],
              subject: "hello world",
              html: "<h1>it works!</h1>",
            },
            {
              from: "Acme <onboarding@resend.dev>",
              to: ["bar@outlook.com"],
              subject: "world hello",
              html: "<p>it works!</p>",
            },
          ]),
          headers: {
            "content-type": "application/json",
            [globalHeaderOverwritten]: overWrittenNewValue,
            [requestHeader]: requestHeaderValue,
          },
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/schedules/https://requestcatcher.com/",
        body: [
          {
            from: "Acme <onboarding@resend.dev>",
            to: ["foo@gmail.com"],
            subject: "hello world",
            html: "<h1>it works!</h1>",
          },
          {
            from: "Acme <onboarding@resend.dev>",
            to: ["bar@outlook.com"],
            subject: "world hello",
            html: "<p>it works!</p>",
          },
        ],
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "content-type": "application/json",
          [`upstash-forward-${requestHeader}`]: requestHeaderValue,
          [`upstash-forward-${globalHeader}`]: globalHeaderValue,
          [`upstash-forward-${globalHeaderOverwritten}`]: overWrittenNewValue,
        },
      },
    });
  });

  test("should create schedule with flow control", async () => {
    const parallelism = 10;
    const ratePerSecond = 5;
    const period = "1d";
    const scheduleId = nanoid();
    await client.schedules.create({
      destination: "https://www.initial.com",
      cron: "*/5 * * * *",
      scheduleId,
      body: "my-payload",
      flowControl: {
        key: "flow-key",
        parallelism,
        rate: ratePerSecond,
        period,
      },
    });

    const schedule = await client.schedules.get(scheduleId);
    expect(schedule.flowControlKey).toBe("flow-key");
    expect(schedule.parallelism).toBe(parallelism);
    expect(schedule.ratePerSecond).toBe(ratePerSecond);
    expect(schedule.rate).toBe(ratePerSecond);
    expect(schedule.period).toBe(SECONDS_IN_A_DAY); // 1d in seconds
  });
});
