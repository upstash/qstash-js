import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import type { HttpClient } from "./http";

// process.env is typed with readonly well-known keys (NODE_ENV), so write
// through a plain record view of it.
const environment = process.env as Record<string, string | undefined>;

const MANAGED_KEYS = [
  "QSTASH_TOKEN",
  "QSTASH_URL",
  "QSTASH_DEV",
  "QSTASH_REGION",
  "NODE_ENV",
] as const;

describe("Client.fromEnv", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of MANAGED_KEYS) {
      original[key] = environment[key];
      Reflect.deleteProperty(environment, key);
    }
  });

  afterEach(() => {
    for (const key of MANAGED_KEYS) {
      const value = original[key];
      if (value === undefined) {
        Reflect.deleteProperty(environment, key);
      } else {
        environment[key] = value;
      }
    }
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

  test("should throw with the dev mode hint when no token is set", () => {
    environment.NODE_ENV = "development";

    expect(() => Client.fromEnv()).toThrow(/client token is not set/);
    expect(() => Client.fromEnv()).toThrow(/QSTASH_DEV=true/);
  });

  test("should throw without the dev mode hint in production", () => {
    environment.NODE_ENV = "production";

    try {
      Client.fromEnv();
      expect.unreachable("fromEnv should throw when no token is set");
    } catch (error) {
      expect((error as Error).message).toInclude("client token is not set");
      expect((error as Error).message).not.toInclude("QSTASH_DEV=true");
    }
  });
});
