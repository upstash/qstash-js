import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { HttpClient } from "./http";
import { upstash } from "./api/llm";
import { QstashMissingCredentialsError } from "./error";
import { captureWarnings, stubEnvironment } from "./test-utils";

const UNAUTHORIZED = 401;
const REQUEST_COUNT = 2;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("missing credential metadata", () => {
  test("warns once at construction and throws a typed error for each request", async () => {
    const { restore } = stubEnvironment(["QSTASH_TOKEN", "QSTASH_REGION", "QSTASH_DEV"]);
    globalThis.fetch = (() =>
      Promise.resolve(new Response("Unauthorized", { status: UNAUTHORIZED }))) as typeof fetch;
    try {
      let client!: Client;
      const warnings = captureWarnings(() => {
        client = new Client({ baseUrl: "https://qstash.example.test", devMode: false });
      });
      expect(warnings).toHaveLength(1);
      for (let attempt = 0; attempt < REQUEST_COUNT; attempt++) {
        try {
          await client.publishJSON({ url: "https://example.test", body: {} });
          expect.unreachable("missing credentials should throw");
        } catch (error) {
          expect(error).toBeInstanceOf(QstashMissingCredentialsError);
          expect((error as QstashMissingCredentialsError).code).toBe("QSTASH_MISSING_CREDENTIALS");
          expect((error as QstashMissingCredentialsError).status).toBe(UNAUTHORIZED);
        }
      }
    } finally {
      restore();
    }
  });

  test("names the error for a standalone HTTP client", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(new Response("Unauthorized", { status: UNAUTHORIZED }))) as typeof fetch;
    const client = new HttpClient({
      baseUrl: "https://qstash.example.test",
      authorization: "Bearer ",
      devMode: false,
    });
    try {
      await client.request({ path: ["v2", "messages"] });
      expect.unreachable("missing credentials should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QstashMissingCredentialsError);
      expect((error as QstashMissingCredentialsError).name).toBe("QstashMissingCredentialsError");
    }
  });

  test("explains a 401 from Upstash chat when no token is set", async () => {
    const { restore } = stubEnvironment(["QSTASH_TOKEN", "QSTASH_REGION", "QSTASH_DEV"]);
    globalThis.fetch = (() =>
      Promise.resolve(new Response("Unauthorized", { status: UNAUTHORIZED }))) as typeof fetch;
    try {
      let client!: Client;
      captureWarnings(() => {
        client = new Client({ baseUrl: "https://qstash.example.test", devMode: false });
      });
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await client.chat().create({
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        provider: upstash(),
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages: [{ role: "user", content: "hi" }],
      });
      expect.unreachable("missing credentials should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QstashMissingCredentialsError);
    } finally {
      restore();
    }
  });

  test("still authenticates Upstash chat with the client token", async () => {
    const authorizations: (string | null)[] = [];
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      authorizations.push(new Headers(init.headers).get("Authorization"));
      return Promise.resolve(Response.json({ choices: [] }));
    }) as typeof fetch;
    const client = new Client({
      baseUrl: "https://qstash.example.test",
      token: "test-token",
      devMode: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await client.chat().create({
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      provider: upstash(),
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(authorizations).toEqual(["Bearer test-token"]);
  });
});
