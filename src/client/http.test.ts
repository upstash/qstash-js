/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect, spyOn } from "bun:test";
import { Client } from "./client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "./workflow/test-utils";

describe("http", () => {
  test("should terminate after sleeping 5 times", () => {
    // init a cient which will always get errors
    const client = new Client({
      baseUrl: "https:/",
      token: "",
      // set retry explicitly
      retry: {
        retries: 5,
        backoff: (retryCount) => Math.exp(retryCount) * 50,
      },
    });

    // get should take 4.287 seconds and terminate before the timeout.
    const throws = () =>
      Promise.race([client.dlq.listMessages(), new Promise((r) => setTimeout(r, 4500))]);

    // if the Promise.race doesn't throw, that means the retries took longer than 4.5s
    expect(throws).toThrow("Was there a typo in the url or port?");
  });

  test("should backoff for seconds in ratelimit", async () => {
    const qstashToken = "my-token";
    const retries = 3;
    const retryDuration = 250;

    const spy = spyOn(console, "warn");

    let ratelimitBacoffCallCount = 0;
    let backoffCallCount = 0;
    const client = new Client({
      baseUrl: MOCK_QSTASH_SERVER_URL,
      token: qstashToken,
      retry: {
        retries,
        ratelimitBackoff: () => {
          ratelimitBacoffCallCount += 1;
          return retryDuration;
        },
        backoff: () => {
          backoffCallCount += 1;
          return 500;
        },
      },
    });

    const throws = () =>
      client.publishJSON({
        url: "https://requestcatcher.com",
      });

    await mockQStashServer({
      execute: () => {
        const start = Date.now();
        expect(throws).toThrowError(
          'Exceeded burst rate limit. {"limit":"100","remaining":"0","reset":"213123"}'
        );
        const duration = Date.now() - start;
        const deviation = Math.abs(retryDuration * retries - duration);
        expect(deviation).toBeLessThan(30);
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://requestcatcher.com",
      },
      responseFields: {
        status: 429,
        headers: {
          "Burst-RateLimit-Limit": "100",
          "Burst-RateLimit-Remaining": "0",
          "Burst-RateLimit-Reset": "213123",
        },
        body: "sdf d",
      },
    });

    expect(ratelimitBacoffCallCount).toBe(retries);
    expect(backoffCallCount).toBe(0);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenLastCalledWith(
      'QStash Ratelimit Exceeded. Retrying after 250 milliseconds. Exceeded burst rate limit. {"limit":"100","remaining":"0","reset":"213123"}'
    );
  });

  test("should not retry on 400", async () => {
    const qstashToken = "my-token";
    const retries = 3;
    const retryDuration = 250;

    let ratelimitBacoffCallCount = 0;
    let backoffCallCount = 0;
    const client = new Client({
      baseUrl: MOCK_QSTASH_SERVER_URL,
      token: qstashToken,
      retry: {
        retries,
        ratelimitBackoff: () => {
          ratelimitBacoffCallCount += 1;
          return retryDuration;
        },
        backoff: () => {
          backoffCallCount += 1;
          return 500;
        },
      },
    });

    const throws = () =>
      client.publishJSON({
        url: "https://requestcatcher.com",
      });

    await mockQStashServer({
      execute: () => {
        const start = Date.now();
        expect(throws).toThrow("can't start with non https or http");
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(30);
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://requestcatcher.com",
      },
      responseFields: {
        status: 400,
        body: "can't start with non https or http",
      },
    });

    expect(ratelimitBacoffCallCount).toBe(0);
    expect(backoffCallCount).toBe(0);
  });
});
