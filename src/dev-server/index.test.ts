/* eslint-disable no-console */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "../client/client";
import { getClientCredentials } from "../client/multi-region/outgoing";
import { getReceiverSigningKeys } from "../client/multi-region/incoming";
import {
  shouldUseDevelopmentMode,
  getDevUrl,
  getRuntime,
  getDevelopmentCredentials,
  ensureDevelopmentServer,
} from "./index";
import { DEV_CREDENTIALS, DEFAULT_DEV_PORT } from "./constants";

// Dev mode must work without any real credentials — save and restore so other
// test files running in the same process are not affected.
const savedToken = process.env.QSTASH_TOKEN;
const savedCurrentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const savedNextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

beforeAll(() => {
  delete process.env.QSTASH_TOKEN;
  delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  delete process.env.QSTASH_NEXT_SIGNING_KEY;
});

afterAll(() => {
  if (savedToken !== undefined) process.env.QSTASH_TOKEN = savedToken;
  if (savedCurrentKey !== undefined) process.env.QSTASH_CURRENT_SIGNING_KEY = savedCurrentKey;
  if (savedNextKey !== undefined) process.env.QSTASH_NEXT_SIGNING_KEY = savedNextKey;
});

// ── shouldUseDevelopmentMode ────────────────────────────────────────────

describe("shouldUseDevelopmentMode", () => {
  test("devMode: true returns true regardless of env", () => {
    expect(shouldUseDevelopmentMode(true, {})).toBe(true);
    expect(shouldUseDevelopmentMode(true, { QSTASH_DEV: "false" })).toBe(true);
  });

  test("devMode: false returns false regardless of env", () => {
    expect(shouldUseDevelopmentMode(false, {})).toBe(false);
    expect(shouldUseDevelopmentMode(false, { QSTASH_DEV: "true" })).toBe(false);
  });

  test("undefined + QSTASH_DEV=true returns true", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "true" })).toBe(true);
  });

  test("undefined + QSTASH_DEV=1 returns true", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "1" })).toBe(true);
  });

  test("undefined + QSTASH_DEV=false returns false", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "false" })).toBe(false);
  });

  test("undefined + QSTASH_DEV=0 returns false", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "0" })).toBe(false);
  });

  test("undefined + QSTASH_DEV='' (empty string) returns false", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "" })).toBe(false);
  });

  test("undefined + no QSTASH_DEV returns false", () => {
    expect(shouldUseDevelopmentMode(undefined, {})).toBe(false);
    // eslint-disable-next-line unicorn/no-useless-undefined
    expect(shouldUseDevelopmentMode(undefined, undefined)).toBe(false);
  });

  test("undefined + QSTASH_DEV=invalid throws", () => {
    expect(() => shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "invalid" })).toThrow(
      "Invalid value for QSTASH_DEV"
    );
  });
});

// ── getDevUrl ───────────────────────────────────────────────────────────

describe("getDevUrl", () => {
  test("returns default port when no QSTASH_DEV_PORT", () => {
    expect(getDevUrl({})).toBe(`http://127.0.0.1:${DEFAULT_DEV_PORT}`);
  });

  test("uses custom port from env object", () => {
    expect(getDevUrl({ QSTASH_DEV_PORT: "9999" })).toBe("http://127.0.0.1:9999");
  });

  test("uses custom port from process.env when env object has no key", () => {
    const original = process.env.QSTASH_DEV_PORT;
    process.env.QSTASH_DEV_PORT = "7777";
    try {
      // undefined env falls back to process.env
      expect(getDevUrl()).toBe("http://127.0.0.1:7777");
    } finally {
      if (original === undefined) delete process.env.QSTASH_DEV_PORT;
      else process.env.QSTASH_DEV_PORT = original;
    }
  });

  test("invalid port string falls back to default", () => {
    expect(getDevUrl({ QSTASH_DEV_PORT: "not-a-number" })).toBe(
      `http://127.0.0.1:${DEFAULT_DEV_PORT}`
    );
    expect(getDevUrl({ QSTASH_DEV_PORT: "-1" })).toBe(`http://127.0.0.1:${DEFAULT_DEV_PORT}`);
    expect(getDevUrl({ QSTASH_DEV_PORT: "0" })).toBe(`http://127.0.0.1:${DEFAULT_DEV_PORT}`);
  });
});

// ── getRuntime ──────────────────────────────────────────────────────────

describe("getRuntime", () => {
  test("returns 'nodejs' in Node/Bun", () => {
    expect(getRuntime()).toBe("nodejs");
  });
});

// ── getDevelopmentCredentials ───────────────────────────────────────────

describe("getDevelopmentCredentials", () => {
  test("returns hardcoded credentials with default port", () => {
    const creds = getDevelopmentCredentials({});
    expect(creds.token).toBe(DEV_CREDENTIALS.token);
    expect(creds.currentSigningKey).toBe(DEV_CREDENTIALS.currentSigningKey);
    expect(creds.nextSigningKey).toBe(DEV_CREDENTIALS.nextSigningKey);
    expect(creds.baseUrl).toBe(`http://127.0.0.1:${DEFAULT_DEV_PORT}`);
  });

  test("uses custom port from env", () => {
    const creds = getDevelopmentCredentials({ QSTASH_DEV_PORT: "9999" });
    expect(creds.baseUrl).toBe("http://127.0.0.1:9999");
  });
});

// ── ensureDevelopmentServer ────────────────────────────────────────────

describe("ensureDevelopmentServer", () => {
  test("no-op when devMode is false", async () => {
    // Should resolve immediately without starting anything
    await ensureDevelopmentServer({}, false);
  });

  test("no-op when QSTASH_DEV is not set and devMode is undefined", async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    await ensureDevelopmentServer({}, undefined);
  });

  test("returns singleton promise on repeated calls", () => {
    const p1 = ensureDevelopmentServer(undefined, true);
    const p2 = ensureDevelopmentServer(undefined, true);
    expect(p1).toBe(p2);
  });
});

// ── Credential priority (outgoing) ─────────────────────────────────────

describe("credential priority", () => {
  test("devMode: true overrides explicit config credentials", () => {
    const result = getClientCredentials({
      environment: {},
      config: { token: "real-token", baseUrl: "https://real.example.com" },
      devMode: true,
    });
    expect(result.token).toBe(DEV_CREDENTIALS.token);
    expect(result.baseUrl).toBe(`http://127.0.0.1:${DEFAULT_DEV_PORT}`);
  });

  test("devMode: false ignores QSTASH_DEV env var", () => {
    const result = getClientCredentials({
      environment: { QSTASH_DEV: "true", QSTASH_TOKEN: "env-token" },
      config: {},
      devMode: false,
    });
    expect(result.token).toBe("env-token");
  });

  test("devMode: true overrides explicit signing key config", () => {
    const result = getReceiverSigningKeys({
      environment: {},
      config: { currentSigningKey: "real-current", nextSigningKey: "real-next" },
      devMode: true,
    });
    expect(result?.currentSigningKey).toBe(DEV_CREDENTIALS.currentSigningKey);
    expect(result?.nextSigningKey).toBe(DEV_CREDENTIALS.nextSigningKey);
  });

  test("devMode: false ignores QSTASH_DEV for signing keys", () => {
    const result = getReceiverSigningKeys({
      environment: {
        QSTASH_DEV: "true",
        QSTASH_CURRENT_SIGNING_KEY: "real-current",
        QSTASH_NEXT_SIGNING_KEY: "real-next",
      },
      devMode: false,
    });
    expect(result?.currentSigningKey).toBe("real-current");
    expect(result?.nextSigningKey).toBe("real-next");
  });
});

// ── Integration tests (require dev server) ─────────────────────────────

describe("dev server integration", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ devMode: true });
    // Ensure server is up before running tests
    await client.publish({ url: "https://example.com", body: "warmup" });
  });

  test(
    "publish works with no credentials and devMode: true",
    async () => {
      const result = await client.publishJSON({
        url: "https://example.com",
        body: { test: true },
      });
      expect(result.messageId).toBeDefined();
    },
    { timeout: 15_000 }
  );

  test(
    "batch publish works",
    async () => {
      const result = await client.batchJSON([
        { url: "https://example.com/1", body: { test: 1 } },
        { url: "https://example.com/2", body: { test: 2 } },
      ]);
      const BATCH_SIZE = 2;
      expect(result).toHaveLength(BATCH_SIZE);
      expect(result[0].messageId).toBeDefined();
      expect(result[1].messageId).toBeDefined();
    },
    { timeout: 15_000 }
  );

  test(
    "queue enqueue works",
    async () => {
      const queue = client.queue({ queueName: "test-queue" });
      const result = await queue.enqueue({
        url: "https://example.com",
        body: "queued message",
      });
      expect(result.messageId).toBeDefined();
    },
    { timeout: 15_000 }
  );
});
