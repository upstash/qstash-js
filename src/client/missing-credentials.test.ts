import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { HttpClient } from "./http";
import { QstashMissingCredentialsError } from "./error";
import { captureWarnings, stubEnvironment } from "./test-utils";

const UNAUTHORIZED = 401;
const REQUEST_COUNT = 2;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("missing credential metadata", () => {
  test("marks errors from a warned client without logging again for each request", async () => {
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
          expect((error as QstashMissingCredentialsError).alreadyLogged).toBe(true);
          expect((error as QstashMissingCredentialsError).status).toBe(UNAUTHORIZED);
        }
      }
    } finally {
      restore();
    }
  });

  test("does not claim a warning was printed by a standalone HTTP client", async () => {
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
      expect((error as QstashMissingCredentialsError).alreadyLogged).toBe(false);
    }
  });
});
