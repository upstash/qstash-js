/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect } from "bun:test";
import { createServer } from "node:http";
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
  test("should wait for five backoffs and stop retrying over a real connection", async () => {
    const requests: { url: string | undefined; authorization: string | undefined }[] = [];
    const backoffCalls: number[] = [];
    // Exercise Client -> fetch -> TCP. Closing before an HTTP response causes
    // a real transport failure without relying on DNS or runtime error wording.
    const server = createServer((request) => {
      requests.push({ url: request.url, authorization: request.headers.authorization });
      request.socket.destroy();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No server port assigned");
      const client = new Client({
        baseUrl: `http://127.0.0.1:${address.port}`,
        token: "test-token",
        devMode: false,
        retry: {
          retries: 5,
          backoff: (retryCount) => {
            backoffCalls.push(retryCount);
            return (retryCount + 1) * 10;
          },
        },
      });
      const startedAt = performance.now();
      const error: unknown = await client.dlq.listMessages().catch((error: unknown) => error);
      const elapsed = performance.now() - startedAt;
      expect(error).toBeInstanceOf(Error);
      expect(requests).toHaveLength(6);
      expect(requests.every((request) => request.url === "/v2/dlq")).toBe(true);
      expect(requests.every((request) => request.authorization === "Bearer test-token")).toBe(true);
      expect(backoffCalls).toEqual([0, 1, 2, 3, 4]);
      // Backoffs total 150 ms. Allow 5 ms of timer tolerance and ample CI overhead.
      expect(elapsed).toBeGreaterThanOrEqual(145);
      expect(elapsed).toBeLessThan(4500);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  test("should call fetch exactly once when retry is disabled", async () => {
    expect(await countFetchCalls(false)).toBe(1);
  });

  test("should call fetch twice when retries is 1", async () => {
    expect(await countFetchCalls({ retries: 1 })).toBe(2);
  });
});
