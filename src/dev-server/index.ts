/* eslint-disable no-console */
import { DEFAULT_DEV_PORT, CONSOLE_URL, DEV_CREDENTIALS } from "./constants";
import type { Runtime } from "./constants";
import { isDevServerRunning, checkDevServerReachable } from "./health";
import { ensureBinary } from "./binary";
import { spawnServer } from "./process";

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

  console.log(`[QStash Dev] Server ready at ${baseUrl}\n  Console: ${consoleLink}\n`);
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
  if (typeof process === "undefined") {
    return "browser";
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!process.release?.name) {
    return "edge";
  }
  // Bun also sets process.release.name to "node", so this covers both
  return "nodejs";
};

const getProcessEnvironment = (key: string): string | undefined =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  typeof process !== "undefined" && process.env ? process.env[key] : undefined;
