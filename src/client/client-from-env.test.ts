import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { QstashError } from "./error";
import type { HttpClient } from "./http";
import { captureWarnings, stubEnvironment } from "./test-utils";

const MANAGED_KEYS = [
  "QSTASH_TOKEN",
  "QSTASH_URL",
  "QSTASH_DEV",
  "QSTASH_REGION",
  "US_EAST_1_QSTASH_TOKEN",
  "US_EAST_1_QSTASH_URL",
  "NODE_ENV",
];

describe("Client.fromEnv", () => {
  let environment: Record<string, string | undefined>;
  let restore: () => void;

  beforeEach(() => {
    ({ environment, restore } = stubEnvironment(MANAGED_KEYS));
  });

  afterEach(() => {
    restore();
  });

  test("should build a client from env variables", () => {
    environment.QSTASH_TOKEN = "env-token";
    environment.QSTASH_URL = "https://custom-qstash.upstash.io";

    const client = Client.fromEnv();

    expect((client.http as HttpClient).baseUrl).toBe("https://custom-qstash.upstash.io");
    expect((client.http as HttpClient).authorization).toBe("Bearer env-token");
  });

  test("should keep other config options", () => {
    environment.QSTASH_TOKEN = "env-token";

    const client = Client.fromEnv({ retry: false });

    expect((client.http as HttpClient).retry.attempts).toBe(0);
  });

  test("should read region-prefixed credentials", () => {
    environment.QSTASH_REGION = "US_EAST_1";
    environment.US_EAST_1_QSTASH_TOKEN = "regional-token";
    environment.US_EAST_1_QSTASH_URL = "https://qstash-us-east-1.upstash.io";

    const client = Client.fromEnv();

    expect((client.http as HttpClient).authorization).toBe("Bearer regional-token");
    expect((client.http as HttpClient).baseUrl).toBe("https://qstash-us-east-1.upstash.io");
  });

  test("should throw with the dev mode hint when no token is set", () => {
    environment.NODE_ENV = "development";

    expect(() => Client.fromEnv()).toThrow(/Unable to find environment variable: QSTASH_TOKEN/);
    expect(() => Client.fromEnv()).toThrow(/QSTASH_DEV=true/);
  });

  test("should throw without the dev mode hint in production", () => {
    environment.NODE_ENV = "production";

    try {
      Client.fromEnv();
      expect.unreachable("fromEnv should throw when no token is set");
    } catch (error) {
      expect(error).toBeInstanceOf(QstashError);
      expect((error as Error).message).toInclude(
        "Unable to find environment variable: QSTASH_TOKEN"
      );
      expect((error as Error).message).not.toInclude("QSTASH_DEV=true");
    }
  });

  test("should resolve credentials once, without duplicating warnings", () => {
    // QSTASH_REGION without the region-prefixed variables warns exactly once.
    environment.QSTASH_TOKEN = "env-token";
    environment.QSTASH_REGION = "US_EAST_1";

    const warnings = captureWarnings(() => Client.fromEnv());

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toInclude("QSTASH_REGION");
  });
});
