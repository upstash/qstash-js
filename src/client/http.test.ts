/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect, spyOn, afterEach } from "bun:test";
import { createServer } from "node:http";
import { Client } from "./client";
import { HttpClient } from "./http";
import { QstashError, QstashRatelimitError } from "./error";

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

describe("http logging", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockFetch = (implementation: () => Promise<Response>) => {
    globalThis.fetch = implementation as unknown as typeof fetch;
  };

  const makeClient = (retry: false | { retries: number }) =>
    new HttpClient({
      baseUrl: "https://example.com",
      authorization: "Bearer test-token",
      retry: retry === false ? false : { ...retry, backoff: () => 0 },
      devMode: false,
    });

  test("should warn on each retry and log an error once when all attempts fail", async () => {
    mockFetch(() => Promise.reject(new Error("forced network failure")));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const error = spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        makeClient({ retries: 2 }).request({
          method: "GET",
          path: ["v2", "messages", "msg_123"],
          query: { secret: "do-not-log" },
        })
      ).rejects.toThrow("forced network failure");

      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0][0]).toContain("GET https://example.com/v2/messages/msg_123");
      expect(warn.mock.calls[0][0]).toContain("attempt 1/3");
      expect(warn.mock.calls[1][0]).toContain("attempt 2/3");

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain("failed after 3 attempts");
      expect(error.mock.calls[0][0]).toContain("forced network failure");

      for (const call of [...warn.mock.calls, ...error.mock.calls]) {
        expect(String(call[0])).not.toContain("do-not-log");
      }
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  test("should not warn when retry is disabled, but still log the error", async () => {
    mockFetch(() => Promise.reject(new Error("forced network failure")));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const error = spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        makeClient(false).request({ method: "GET", path: ["v2", "messages", "msg_123"] })
      ).rejects.toThrow("forced network failure");

      expect(warn).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain("failed after 1 attempt:");
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  test("should log an error for non-2xx responses", async () => {
    mockFetch(() => Promise.resolve(new Response("message not found", { status: 404 })));
    const error = spyOn(console, "error").mockImplementation(() => {});

    try {
      const request = makeClient({ retries: 2 }).request({
        method: "DELETE",
        path: ["v2", "messages", "msg_123"],
      });
      await expect(request).rejects.toBeInstanceOf(QstashError);

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain(
        "DELETE https://example.com/v2/messages/msg_123 failed with status 404"
      );
      expect(String(error.mock.calls[0][0])).not.toContain("message not found");
    } finally {
      error.mockRestore();
    }
  });

  test("should log an error for rate limit responses", async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response("", { status: 429, headers: { "Burst-RateLimit-Limit": "100" } })
      )
    );
    const error = spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        makeClient({ retries: 2 }).request({ method: "POST", path: ["v2", "publish", "x"] })
      ).rejects.toBeInstanceOf(QstashRatelimitError);

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain("failed with status 429");
    } finally {
      error.mockRestore();
    }
  });

  test("should not log anything for successful requests", async () => {
    mockFetch(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const error = spyOn(console, "error").mockImplementation(() => {});

    try {
      await makeClient({ retries: 2 }).request({ method: "GET", path: ["v2", "keys"] });
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
