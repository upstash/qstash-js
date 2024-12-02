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

  test.only("should backoff for seconds in ratelimit", async () => {
    const qstashToken = "my-token";
    const retries = 3;

    const spy = spyOn(console, "warn");

    let callCount = 0;
    const client = new Client({
      baseUrl: MOCK_QSTASH_SERVER_URL,
      token: qstashToken,
      retry: {
        retries,
        ratelimitBackoff: () => {
          callCount += 1;
          return 250;
        },
      },
    });

    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          url: "https://requestcatcher.com",
        });
        expect(callCount).toBe(retries);
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
        body: "ratelimited",
      },
    });

    expect(callCount).toBe(retries);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenLastCalledWith(
      'QStash Ratelimit Exceeded. Retrying after 250 milliseconds. Exceeded burst rate limit. {"limit":"100","remaining":"0","reset":"213123"}'
    );
  });
});
