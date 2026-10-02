import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { QstashError } from "./error";
import type { HttpClient } from "./http";

const MANAGED_KEYS = [
  "NODE_ENV",
  "QSTASH_DEV",
  "QSTASH_TOKEN",
  "QSTASH_URL",
  "QSTASH_REGION",
  "US_EAST_1_QSTASH_TOKEN",
  "US_EAST_1_QSTASH_URL",
];

describe("Client.fromEnv", () => {
  const environment = process.env as Record<string, string | undefined>;
  let original: Record<string, string | undefined>;

  beforeEach(() => {
    original = Object.fromEntries(MANAGED_KEYS.map((key) => [key, environment[key]]));
    for (const key of MANAGED_KEYS) Reflect.deleteProperty(environment, key);
  });

  afterEach(() => {
    for (const key of MANAGED_KEYS) {
      if (original[key] === undefined) Reflect.deleteProperty(environment, key);
      else environment[key] = original[key];
    }
  });

  test("builds a client from env variables", () => {
    environment.QSTASH_TOKEN = "env-token";
    environment.QSTASH_URL = "https://custom-qstash.upstash.io";

    const http = Client.fromEnv({ retry: false }).http as HttpClient;

    expect(http.baseUrl).toBe("https://custom-qstash.upstash.io");
    expect(http.authorization).toBe("Bearer env-token");
    expect(http.retry.attempts).toBe(0);
  });

  test("reads region-prefixed credentials", () => {
    environment.QSTASH_REGION = "US_EAST_1";
    environment.US_EAST_1_QSTASH_TOKEN = "regional-token";
    environment.US_EAST_1_QSTASH_URL = "https://qstash-us-east-1.upstash.io";

    const http = Client.fromEnv().http as HttpClient;

    expect(http.authorization).toBe("Bearer regional-token");
    expect(http.baseUrl).toBe("https://qstash-us-east-1.upstash.io");
  });

  test("throws with the dev mode hint when no token is set", () => {
    expect(() => Client.fromEnv()).toThrow(QstashError);
    expect(() => Client.fromEnv()).toThrow(/Unable to find environment variable: QSTASH_TOKEN/);
    expect(() => Client.fromEnv()).toThrow(/QSTASH_DEV=true/);
  });

  test("new Client() still only warns", () => {
    expect(() => new Client()).not.toThrow();
  });
});
