/* eslint-disable @typescript-eslint/no-deprecated */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Mock } from "bun:test";
import { serve } from "./serve";
import { stubEnvironment } from "../test-utils";
import { Client } from "../client";

const UNAUTHORIZED = 401;
const INTERNAL_SERVER_ERROR = 500;
const REQUEST_COUNT = 2;

describe("Workflow missing credentials", () => {
  let environment: Record<string, string | undefined>;
  let restore: () => void;
  const originalFetch = globalThis.fetch;
  let errorLog: Mock<typeof console.error>;
  let warningLog: Mock<typeof console.warn>;

  beforeEach(() => {
    ({ environment, restore } = stubEnvironment([
      "NODE_ENV",
      "QSTASH_TOKEN",
      "QSTASH_URL",
      "QSTASH_REGION",
      "QSTASH_DEV",
      "QSTASH_CURRENT_SIGNING_KEY",
      "QSTASH_NEXT_SIGNING_KEY",
    ]));
    environment.QSTASH_DEV = "false";
    environment.QSTASH_URL = "https://qstash.example.test";
    globalThis.fetch = (() =>
      Promise.resolve(new Response("Unauthorized", { status: UNAUTHORIZED }))) as typeof fetch;
    errorLog = spyOn(console, "error").mockImplementation(() => {
      // Inspect the captured error without writing it to the test output.
    });
    warningLog = spyOn(console, "warn").mockImplementation(() => {
      // Missing credentials are intentional in these tests.
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    errorLog.mockRestore();
    warningLog.mockRestore();
    restore();
  });

  test.each([undefined, "development", "production"])(
    "returns and logs missing-token errors without the stack when NODE_ENV is %s",
    async (nodeEnvironment) => {
      if (nodeEnvironment) environment.NODE_ENV = nodeEnvironment;
      const handler = serve(async (context) => {
        await context.sleep("wait", 1);
      });

      for (let attempt = 0; attempt < REQUEST_COUNT; attempt++) {
        const response = await handler(
          new Request("https://workflow.example.test", { method: "POST", body: "{}" })
        );
        const body = (await response.json()) as { message: string; stack?: string };

        expect(response.status).toBe(INTERNAL_SERVER_ERROR);
        expect(body.message).toInclude("client token is not set");
        expect(body.message.includes("QSTASH_DEV=true")).toBe(nodeEnvironment === "development");
        expect(body).not.toHaveProperty("stack");
      }
      expect(warningLog).toHaveBeenCalledTimes(1);
      // Each failed request leaves a log line, without a stack trace.
      expect(errorLog).toHaveBeenCalledTimes(REQUEST_COUNT);
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("client token is not set"));
    }
  );

  test("does not warn about a discarded default client when a client is supplied", async () => {
    const qstashClient = new Client({ token: "configured-token", devMode: false });
    const handler = serve(
      async (context) => {
        await context.sleep("wait", 1);
      },
      { qstashClient }
    );
    const response = await handler(
      new Request("https://workflow.example.test", { method: "POST", body: "{}" })
    );
    expect(((await response.json()) as { message: string }).message).toBe("Unauthorized");
    expect(warningLog).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  test("preserves the server error and stack for an invalid configured token", async () => {
    environment.NODE_ENV = "development";
    environment.QSTASH_TOKEN = "invalid-token";
    const handler = serve(async (context) => {
      await context.sleep("wait", 1);
    });

    const response = await handler(
      new Request("https://workflow.example.test", { method: "POST", body: "{}" })
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(INTERNAL_SERVER_ERROR);
    expect(body.message).toBe("Unauthorized");
    expect(errorLog).toHaveBeenCalledWith(expect.any(Error));
  });
});
