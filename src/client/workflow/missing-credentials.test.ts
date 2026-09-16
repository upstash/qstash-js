/* eslint-disable @typescript-eslint/no-deprecated */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Mock } from "bun:test";
import { serve } from "./serve";
import { stubEnvironment } from "../test-utils";

const UNAUTHORIZED = 401;
const INTERNAL_SERVER_ERROR = 500;

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

  test.each(["development", "production"])(
    "preserves the missing-token message in %s responses",
    async (nodeEnvironment) => {
      environment.NODE_ENV = nodeEnvironment;
      const handler = serve(async (context) => {
        await context.sleep("wait", 1);
      });

      const response = await handler(
        new Request("https://workflow.example.test", { method: "POST", body: "{}" })
      );
      const body = (await response.json()) as { message: string };

      expect(response.status).toBe(INTERNAL_SERVER_ERROR);
      expect(body.message).toInclude("client token is not set");
      expect(body.message.includes("QSTASH_DEV=true")).toBe(nodeEnvironment === "development");
      expect(errorLog).toHaveBeenCalledWith(body.message);
    }
  );

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
