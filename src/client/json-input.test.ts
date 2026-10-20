import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "./client";

const originalFetch = globalThis.fetch;

const captureRequests = () => {
  const requests: { url: string; headers: { get(name: string): string | null }; body: string }[] =
    [];
  // The client always calls fetch with a string url.
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    requests.push({
      url,
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : "",
    });
    const responseBody = url.endsWith("/v2/batch")
      ? [{ messageId: "msg_1" }]
      : { messageId: "msg_1" };
    return Promise.resolve(new Response(JSON.stringify(responseBody), { status: 200 }));
  }) as typeof fetch;
  return requests;
};

const makeClient = () =>
  new Client({ baseUrl: "https://qstash.example.com", token: "test-token", devMode: false });

describe("JSON helpers do not mutate their input", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("batchJSON leaves message bodies as objects and is safe to call again", async () => {
    const requests = captureRequests();
    const client = makeClient();
    const messages = [{ url: "https://example.com/hook", body: { hello: "world" } }];

    await client.batchJSON(messages);
    await client.batchJSON(messages);

    expect(messages[0].body).toEqual({ hello: "world" });

    const [first, second] = requests.map(
      (request) => JSON.parse(request.body) as { body: string }[]
    );
    expect(first[0].body).toBe('{"hello":"world"}');
    expect(second[0].body).toBe(first[0].body);
  });

  test("publishJSON leaves the caller's headers untouched", async () => {
    const requests = captureRequests();
    const client = makeClient();
    const headers = { "x-custom": "1" };
    const request = { url: "https://example.com/hook", body: { a: 1 }, headers };

    await client.publishJSON(request);

    expect(request.headers).toBe(headers);
    expect(request.headers).toEqual({ "x-custom": "1" });
    expect(requests[0].headers.get("Upstash-Forward-x-custom")).toBe("1");
    expect(requests[0].headers.get("Content-Type")).toBe("application/json");
  });
});
