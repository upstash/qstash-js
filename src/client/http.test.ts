/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect } from "bun:test";
import { Client } from "./client";
import { HttpClient } from "./http";

const countFetchCalls = async (retry: false | { retries: number }) => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (() => {
    fetchCalls += 1;
    return Promise.reject(new Error(`forced network failure ${fetchCalls}`));
  }) as typeof fetch;

  const client = new HttpClient({
    baseUrl: "https://example.com",
    authorization: "Bearer test-token",
    retry,
    devMode: false,
  });

  try {
    await client.request({ method: "GET", path: ["v2", "messages", "msg_123"] });
    throw new Error("expected request to throw");
  } catch {
    // request is expected to fail
  } finally {
    globalThis.fetch = originalFetch;
  }

  return fetchCalls;
};

describe("http", () => {
  test(
    "should terminate after sleeping 5 times",
    async () => {
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

      // The five backoff sleeps add up to ~4.29s. The race window only has to
      // prove the retries are bounded, so leave headroom for slow CI runners
      // rather than racing the sleeps by a couple hundred milliseconds.
      const TIMED_OUT = Symbol("timed out");
      const outcome = await Promise.race([
        client.dlq.listMessages().then(
          () => "resolved",
          (error: unknown) => error
        ),
        new Promise<typeof TIMED_OUT>((r) => {
          setTimeout(() => {
            r(TIMED_OUT);
          }, 7000);
        }),
      ]);

      // Once the retries are exhausted the underlying network error must
      // surface. Its wording is Bun's and changed between 1.3 ("Was there a
      // typo in the url or port?") and 1.4 ("getaddrinfo ENOTFOUND v2"), so
      // only assert that an error came back before the window closed.
      expect(outcome).not.toBe(TIMED_OUT);
      expect(outcome).toBeInstanceOf(Error);
    },
    { timeout: 10_000 }
  );

  test("should call fetch exactly once when retry is disabled", async () => {
    expect(await countFetchCalls(false)).toBe(1);
  });

  test("should call fetch twice when retries is 1", async () => {
    expect(await countFetchCalls({ retries: 1 })).toBe(2);
  });
});
