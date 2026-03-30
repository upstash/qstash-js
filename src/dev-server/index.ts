/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable no-console */

import {
  DEFAULT_DEV_PORT,
  CONSOLE_URL,
  DEV_QSTASH_TOKEN,
  DEV_QSTASH_CURRENT_SIGNING_KEY,
  DEV_QSTASH_NEXT_SIGNING_KEY,
} from "./constants";
import type { DevelopmentCredentials, Runtime } from "./constants";
import { isDevServerRunning, checkDevServerReachable } from "./health";
import { fetchLatestVersion, findCacheDirectory, downloadBinary } from "./binary";
import { spawnServer, registerCleanup } from "./process";
import { importFs } from "./constants";

/**
 * Detect the current JS runtime environment.
 */
export const getRuntime = (): Runtime => {
  // Cloudflare Workers: navigator.userAgent === "Cloudflare-Workers"
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    return "cloudflare-workers";
  }
  // No process at all — browser
  if (typeof process === "undefined") {
    return "browser";
  }
  // process exists but no release info — edge runtime (Next.js edge, Vercel Edge, etc.)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!process.release?.name) {
    return "edge";
  }
  return "nodejs";
};

/**
 * Get the dev server URL from environment or use default.
 */
export const getDevUrl = (env?: Record<string, string | undefined>): string => {
  const portStr = env?.QSTASH_DEV_PORT ?? getProcessEnv("QSTASH_DEV_PORT");
  let port = DEFAULT_DEV_PORT;
  if (portStr) {
    const parsed = Number.parseInt(portStr, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      port = parsed;
    }
  }
  return `http://127.0.0.1:${port}`;
};

/**
 * Get dev server credentials.
 */
export const getDevelopmentCredentials = (
  env?: Record<string, string | undefined>
): DevelopmentCredentials => {
  return {
    token: DEV_QSTASH_TOKEN,
    currentSigningKey: DEV_QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: DEV_QSTASH_NEXT_SIGNING_KEY,
    baseUrl: getDevUrl(env),
  };
};

let devServerPromise: Promise<void> | undefined;

/**
 * Ensure the dev server is running. Returns a singleton promise
 * that resolves once the server is ready.
 *
 * No-op when:
 * - `typeof process === "undefined"` (edge/browser)
 * - dev mode is not enabled (via `devMode` param or `QSTASH_DEV` env var)
 *
 * @param env - Environment variables
 * @param devMode - Explicit override: `true` forces on, `false` forces off, `undefined` checks env
 */
export const ensureDevelopmentServer = (
  env?: Record<string, string | undefined>,
  devMode?: boolean
): Promise<void> => {
  const runtime = getRuntime();
  if (runtime !== "nodejs") {
    // If dev mode is active, verify the server is reachable — otherwise
    // the user will get an unhelpful "fetch failed" error later.
    if (shouldUseDevelopmentMode(devMode, env)) {
      return checkDevServerReachable(getDevUrl(env), runtime);
    }
    return Promise.resolve();
  }
  if (!shouldUseDevelopmentMode(devMode, env)) {
    return Promise.resolve();
  }
  if (devServerPromise) {
    return devServerPromise;
  }
  devServerPromise = startPipeline(env).catch((error: unknown) => {
    devServerPromise = undefined;
    throw error;
  });
  return devServerPromise;
};

/**
 * Determine if dev mode should be active.
 * `devMode` param takes priority: `true` → on, `false` → off, `undefined` → check env.
 */
export const shouldUseDevelopmentMode = (
  devMode?: boolean,
  env?: Record<string, string | undefined>
): boolean => {
  if (devMode !== undefined) {
    return devMode;
  }
  const value = env?.QSTASH_DEV ?? getProcessEnv("QSTASH_DEV");
  if (value === undefined) return false;
  if (value === "true" || value === "1" || value === "") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`[QStash Dev] Invalid value for QSTASH_DEV in environment: ${value}`);
};

const getProcessEnv = (key: string): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof process !== "undefined" && process.env) return process.env[key];
  return undefined;
};

const getPortFromUrl = (url: string): string => {
  return new URL(url).port;
};

const startPipeline = async (env?: Record<string, string | undefined>): Promise<void> => {
  const baseUrl = getDevUrl(env);

  if (await isDevServerRunning(baseUrl)) {
    console.log(
      `[QStash Dev] Server already running at ${baseUrl}\n` +
        `  Console: \u001B[36m${CONSOLE_URL}?port=${getPortFromUrl(baseUrl)}\u001B[0m\n`
    );
    return;
  }

  const cacheDir = await findCacheDirectory();

  const fs = await importFs();
  const cachedBinaryPath = `${cacheDir}/qstash`;
  const versionFile = `${cacheDir}/.version`;
  let version: string;
  try {
    version = await fetchLatestVersion();
  } catch (error) {
    // Network failed — if we have a cached binary, use it
    if (fs.existsSync(cachedBinaryPath)) {
      const cachedVersion = fs.existsSync(versionFile)
        ? fs.readFileSync(versionFile, "utf8").trim()
        : "unknown";
      console.log(`[QStash Dev] Could not check for updates, using cached v${cachedVersion}`);
      version = cachedVersion;
    } else {
      throw error;
    }
  }
  const binaryPath = await downloadBinary(version, cacheDir);

  const child = await spawnServer(binaryPath, getPortFromUrl(baseUrl));

  registerCleanup(child);

  console.log(
    `[QStash Dev] Server ready at ${baseUrl}\n` +
      `  Console: \u001B[36m${CONSOLE_URL}?port=${getPortFromUrl(baseUrl)}\u001B[0m\n`
  );
};

/** Reset the singleton for testing */
export const _resetDevServerPromise = () => {
  devServerPromise = undefined;
};
