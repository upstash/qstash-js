/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-empty-function */
import { describe, test, expect, beforeAll, afterAll, spyOn } from "bun:test";

import * as binary from "./binary";
import { ensureDevelopmentServer, startDevServer, stopDevServer } from "./index";
import { Client } from "../client/client";

// We make the spawn pipeline fail deterministically and WITHOUT network access
// by spying on `ensureBinary` (the first network/IO step) and forcing it to
// reject. `index.ts` calls it through the live module binding, so the spy
// intercepts it. Each test installs and restores its own spy, so nothing leaks
// into other test files (unlike a process-global `mock.module`).
const SPAWN_ERROR = "[QStash Dev] forced spawn failure (test)";
const failBinary = () => spyOn(binary, "ensureBinary").mockRejectedValue(new Error(SPAWN_ERROR));

// Run on a free port so isDevServerRunning() is false and the pipeline reaches
// the (spied, failing) ensureBinary step instead of short-circuiting.
const FREE_PORT = "8585";

const savedToken = process.env.QSTASH_TOKEN;
const savedCurrentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const savedNextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const savedPort = process.env.QSTASH_DEV_PORT;
const savedDev = process.env.QSTASH_DEV;
const savedNodeEnv = process.env.NODE_ENV;
const savedPhase = process.env.NEXT_PHASE;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else process.env[key] = value;
};

beforeAll(() => {
  delete process.env.QSTASH_TOKEN;
  delete process.env.QSTASH_CURRENT_SIGNING_KEY;
  delete process.env.QSTASH_NEXT_SIGNING_KEY;
  process.env.QSTASH_DEV_PORT = FREE_PORT;
});

afterAll(() => {
  stopDevServer();
  restoreEnv("QSTASH_TOKEN", savedToken);
  restoreEnv("QSTASH_CURRENT_SIGNING_KEY", savedCurrentKey);
  restoreEnv("QSTASH_NEXT_SIGNING_KEY", savedNextKey);
  restoreEnv("QSTASH_DEV_PORT", savedPort);
  restoreEnv("QSTASH_DEV", savedDev);
  restoreEnv("NODE_ENV", savedNodeEnv);
  restoreEnv("NEXT_PHASE", savedPhase);
});

const withEnv = async (
  overrides: Record<string, string | undefined>,
  function_: () => Promise<void>
) => {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    restoreEnv(key, overrides[key]);
  }
  try {
    await function_();
  } finally {
    for (const key of Object.keys(previous)) restoreEnv(key, previous[key]);
  }
};

// ── ensureDevelopmentServer: precise-error contract ─────────────────────

describe("ensureDevelopmentServer (precise-error contract)", () => {
  test("rejects on spawn failure", async () => {
    stopDevServer();
    const spy = failBinary();
    try {
      const promise = ensureDevelopmentServer(undefined, true);
      // Catch first so the rejection is handled, then assert it rejected.
      const caught = await promise.then(
        () => {},
        (error: unknown) => error
      );
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe(SPAWN_ERROR);
    } finally {
      spy.mockRestore();
    }
  });

  test("resets its singleton after a failed spawn so a later call retries", async () => {
    stopDevServer();
    const spy = failBinary();
    try {
      // Both calls must reject; the second proves the singleton was reset (the
      // pipeline ran ensureBinary again) rather than returning a cached
      // rejected promise. We assert ensureBinary was called twice.
      const swallow = (error: unknown) => error;
      const firstError = await ensureDevelopmentServer(undefined, true).then(() => {}, swallow);
      const secondError = await ensureDevelopmentServer(undefined, true).then(() => {}, swallow);
      expect(firstError).toBeInstanceOf(Error);
      expect(secondError).toBeInstanceOf(Error);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });
});

// ── startDevServer: public boundary never throws ────────────────────────

describe("startDevServer (public boundary)", () => {
  test("resolves and warns when the spawn fails (does not throw)", async () => {
    stopDevServer();
    const spy = failBinary();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await withEnv(
        { QSTASH_DEV: "true", NODE_ENV: undefined, NEXT_PHASE: undefined },
        async () => {
          // Must resolve even though ensureDevelopmentServer rejects.
          await startDevServer();
        }
      );
      expect(warnSpy).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const firstArgument: unknown = warnSpy.mock.calls[0]?.[0];
      expect(String(firstArgument)).toContain("Could not start dev server");
    } finally {
      warnSpy.mockRestore();
      spy.mockRestore();
    }
  });

  test("resolves (does not throw) when QSTASH_DEV is malformed", async () => {
    stopDevServer();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await withEnv(
        { QSTASH_DEV: "totally-bogus", NODE_ENV: undefined, NEXT_PHASE: undefined },
        async () => {
          // shouldUseDevelopmentMode throws internally; startDevServer must swallow it.
          await startDevServer();
        }
      );
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("no-op when QSTASH_DEV is unset", async () => {
    const spy = failBinary();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await withEnv({ QSTASH_DEV: undefined, NODE_ENV: undefined, NEXT_PHASE: undefined }, () =>
        startDevServer()
      );
      // Gated off → ensureBinary never reached, no "could not start" warning.
      expect(spy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      spy.mockRestore();
    }
  });

  test("no-op in production (NODE_ENV=production)", async () => {
    const spy = failBinary();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await withEnv({ QSTASH_DEV: "true", NODE_ENV: "production", NEXT_PHASE: undefined }, () =>
        startDevServer()
      );
      expect(spy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      spy.mockRestore();
    }
  });

  test("no-op during build (NEXT_PHASE=phase-production-build)", async () => {
    const spy = failBinary();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await withEnv(
        { QSTASH_DEV: "true", NODE_ENV: undefined, NEXT_PHASE: "phase-production-build" },
        () => startDevServer()
      );
      expect(spy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      spy.mockRestore();
    }
  });
});

// ── Client fire-and-forget: no unhandled rejection ──────────────────────

describe("Client fire-and-forget dev-server start", () => {
  test("constructing a Client whose dev-server start fails does not produce an unhandled rejection", async () => {
    stopDevServer();
    const spy = failBinary();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      await withEnv(
        { QSTASH_DEV: "true", NODE_ENV: undefined, NEXT_PHASE: undefined },
        async () => {
          // Constructor calls ensureDevelopmentServer(...).catch(...); the spied
          // ensureBinary makes that promise reject. The .catch must absorb it.
          // eslint-disable-next-line no-new
          new Client({ devMode: true });
          // Let the rejected promise settle; without the .catch the rejection
          // would surface as unhandledRejection within a few ticks.
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      );
      expect(unhandled).toHaveLength(0);
      // The catch logs a warning instead of silently swallowing.
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onUnhandled);
      warnSpy.mockRestore();
      spy.mockRestore();
      stopDevServer();
    }
  });
});
