/* eslint-disable @typescript-eslint/no-magic-numbers */
import { describe, test, expect } from "bun:test";
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

const requestWith401 = async (authorization: string, requestHeaders?: Record<string, string>) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response("Unauthorized", { status: 401 }))) as typeof fetch;

  const client = new HttpClient({
    baseUrl: "https://example.com",
    authorization,
    retry: false,
    devMode: false,
  });

  try {
    await client.request({
      method: "GET",
      path: ["v2", "messages", "msg_123"],
      headers: requestHeaders,
    });
    throw new Error("expected request to throw");
  } catch (error) {
    return error as Error;
  } finally {
    globalThis.fetch = originalFetch;
  }
};

describe("http", () => {
  test("should stop after five retries and preserve the final network error", async () => {
    const originalFetch = globalThis.fetch;
    const networkError = new Error("forced network failure");
    let fetchCalls = 0;
    const backoffCalls: number[] = [];
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(networkError);
    }) as typeof fetch;

    const client = new HttpClient({
      baseUrl: "https://example.com",
      authorization: "Bearer test-token",
      devMode: false,
      retry: {
        retries: 5,
        backoff: (retryCount) => {
          backoffCalls.push(retryCount);
          return 0;
        },
      },
    });

    try {
      const result: unknown = await client
        .request({ method: "GET", path: ["v2", "dlq"] })
        .catch((error: unknown) => error);
      expect(result).toBe(networkError);
      expect(fetchCalls).toBe(6);
      expect(backoffCalls).toEqual([0, 1, 2, 3, 4]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("should call fetch exactly once when retry is disabled", async () => {
    expect(await countFetchCalls(false)).toBe(1);
  });

  test("should call fetch twice when retries is 1", async () => {
    expect(await countFetchCalls({ retries: 1 })).toBe(2);
  });

  describe("401 handling", () => {
    test("should explain a 401 caused by a missing token", async () => {
      const error = await requestWith401("Bearer ");

      expect(error.message).toInclude("client token is not set");
    });

    test("should keep the server error when a token is set", async () => {
      const error = await requestWith401("Bearer test-token");

      expect(error.message).toBe("Unauthorized");
    });

    test("should keep the server error when the request carries its own key", async () => {
      // e.g. `client.chat` against a custom LLM provider: the 401 comes from the
      // provider, not from QStash, even when no QStash token is configured.
      const error = await requestWith401("Bearer ", { Authorization: "Bearer provider-key" });

      expect(error.message).toBe("Unauthorized");
    });

    test("should keep the server error when the request's own key is empty", async () => {
      // `chat` doesn't validate the provider token, so an unset OPENAI_API_KEY
      // sends `Bearer ` to the provider. That 401 is about the provider, not
      // QStash, even when the QStash token is missing too.
      const error = await requestWith401("Bearer ", { Authorization: "Bearer " });

      expect(error.message).toBe("Unauthorized");
    });
  });
});
