/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect } from "bun:test";
import { Client } from "./client";

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
});
