/* eslint-disable no-console */
import { DEFAULT_DEV_PORT, CONSOLE_URL, DEV_CREDENTIALS } from "./constants";
import type { Runtime } from "./constants";
import { isDevServerRunning, checkDevServerReachable } from "./health";
import { ensureBinary } from "./binary";
import { spawnServer, stopCurrentServer } from "./process";

// Read the `process` global through a dynamically-keyed property so Next.js's
// Edge Runtime static analyzer can't see the reference: it scans direct
// `process.X` references but not property reads on a dynamically-keyed object.
type ProcessLike = {
  release?: { name?: string };
  env?: Record<string, string | undefined>;
};
const _processGlobal = (): ProcessLike | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const proc = (globalThis as any)["pro" + "cess"];
  return proc as ProcessLike | undefined;
};

// Singleton promise so multiple callers (Client, HttpClient, etc.) share one startup sequence.
let devServerPromise: Promise<void> | undefined;

/**
 * Ensure the dev server is running. Returns a singleton promise
 * that resolves once the server is ready.
 *
 * No-op when:
 * - `typeof process === "undefined"` (edge/browser)
 * - dev mode is not enabled
 *
 * @param devMode - Explicit override: `true` forces on, `false` forces off, `undefined` checks env
 */
export const ensureDevelopmentServer = (
  env: Record<string, string | undefined> | undefined,
  devMode: boolean | undefined
): Promise<void> => {
  if (!shouldUseDevelopmentMode(devMode, env)) return Promise.resolve();

  const runtime = getRuntime();

  // Edge/browser can't spawn processes, just verify the server is reachable
  // so the user gets a helpful error instead of a generic "fetch failed".
  if (runtime !== "nodejs") {
    return checkDevServerReachable(getDevUrl(env), runtime);
  }

  if (!devServerPromise) {
    devServerPromise = startPipeline(env).catch((error: unknown) => {
      devServerPromise = undefined;
      throw error;
    });
  }

  return devServerPromise;
};

/**
 * Stop the spawned dev server (if any) and reset the singleton so a future
 * call to {@link ensureDevelopmentServer} starts a fresh process. Intended
 * for tests that need to release the port between runs.
 */
export const stopDevelopmentServer = (): void => {
  stopCurrentServer();
  devServerPromise = undefined;
};

const startPipeline = async (env?: Record<string, string | undefined>): Promise<void> => {
  const baseUrl = getDevUrl(env);
  const port = new URL(baseUrl).port;
  const consoleLink = `\u001B[36m${CONSOLE_URL}?port=${port}\u001B[0m`;

  if (await isDevServerRunning(baseUrl)) {
    console.log(`[QStash Dev] Server already running at ${baseUrl}\n  Console: ${consoleLink}\n`);
    return;
  }

  const binaryPath = await ensureBinary();

  await spawnServer(binaryPath, port, () => {
    // Reset singleton so the next call to ensureDevelopmentServer restarts the server
    devServerPromise = undefined;
  });
};

// --- Utils ---

/**
 * Determine if dev mode should be active.
 * `devMode` param takes priority: `true` → on, `false` → off, `undefined` → check env.
 */
export const shouldUseDevelopmentMode = (
  devMode: boolean | undefined,
  env: Record<string, string | undefined> | undefined
): boolean => {
  if (devMode !== undefined) return devMode;

  const value = env?.QSTASH_DEV ?? getProcessEnvironment("QSTASH_DEV");

  if (value === undefined || value === "" || value === "false" || value === "0") return false;
  if (value === "true" || value === "1") return true;

  throw new Error(`[QStash Dev] Invalid value for QSTASH_DEV in environment: ${value}`);
};

export const getDevelopmentCredentials = (env?: Record<string, string | undefined>) => {
  return {
    ...DEV_CREDENTIALS,
    baseUrl: getDevUrl(env),
  };
};

export const getDevUrl = (env?: Record<string, string | undefined>): string => {
  const portString = env?.QSTASH_DEV_PORT ?? getProcessEnvironment("QSTASH_DEV_PORT");
  let port = DEFAULT_DEV_PORT;
  if (portString) {
    const parsed = Number.parseInt(portString, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      port = parsed;
    }
  }
  return `http://127.0.0.1:${port}`;
};

export const getRuntime = (): Runtime => {
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    return "cloudflare-workers";
  }
  const proc = _processGlobal();
  if (!proc) {
    return "browser";
  }
  if (!proc.release?.name) {
    return "edge";
  }
  // Bun also sets process.release.name to "node", so this covers both
  return "nodejs";
};

const getProcessEnvironment = (key: string): string | undefined => {
  const proc = _processGlobal();
  return proc?.env ? proc.env[key] : undefined;
};
