/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect, spyOn, afterEach } from "bun:test";
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
        "DELETE https://example.com/v2/messages/msg_123 failed with status 404: message not found"
      );
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
