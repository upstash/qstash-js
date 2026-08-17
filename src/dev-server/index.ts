/* eslint-disable no-console */
import { DEFAULT_DEV_PORT, CONSOLE_URL, DEV_CREDENTIALS, DEV_PREFIX } from "./constants";
export { DEV_PREFIX } from "./constants";
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
 * Ensure the dev server is running, resolving once it's ready.
 *
 * Concurrent callers (Client, HttpClient, etc.) share a single startup:
 * the spawn is deduped internally via a shared promise, so only one binary
 * is launched even though each call returns its own promise awaiting it.
 *
 * Behaviour by situation:
 * - dev mode not enabled, `next build`, or production → no-op
 * - Node.js runtime → downloads (if needed) and spawns the dev binary
 * - edge/browser/Cloudflare (can't spawn a process) → only verifies the
 *   server is reachable, throwing a helpful error if it isn't
 *
 * @param devMode - Explicit override: `true` forces on, `false` forces off, `undefined` checks env
 */
export const ensureDevelopmentServer = async (
  env: Record<string, string | undefined> | undefined,
  devMode: boolean | undefined
): Promise<void> => {
  if (!shouldUseDevelopmentMode(devMode, env)) return;

  // Don't spawn during a build (`next build`, etc.) — the route module may be
  // evaluated at build time but the dev binary should only run in `next dev`.
  // Also short-circuit in production so an accidental devMode: true in prod
  // doesn't try to download a binary.
  const procEnv = _processGlobal()?.env;
  if (procEnv?.NEXT_PHASE === "phase-production-build") return;
  if (procEnv?.NODE_ENV === "production") return;

  const runtime = getRuntime();

  // Edge/browser can't spawn processes, just verify the server is reachable
  // so the user gets a helpful error instead of a generic "fetch failed".
  if (runtime !== "nodejs") {
    await checkDevServerReachable(getDevUrl(env), runtime);
    return;
  }

  // Share a single startup across all callers; drop it on failure so a later
  // call (e.g. a real publish request) retries and can surface the error.
  if (!devServerPromise) {
    devServerPromise = startPipeline(env).catch((error: unknown) => {
      devServerPromise = undefined;
      throw error;
    });
  }

  await devServerPromise;
};

/**
 * Starts the local QStash dev server when `QSTASH_DEV` is `1`/`true` (otherwise
 * does nothing).
 *
 * You usually don't need this: the dev server also starts automatically when you
 * construct a `Client` or send a publish request. Call it only when you want to
 * start it manually up front — e.g. from a script or a Next.js
 * `instrumentation.ts` hook.
 *
 * Never throws; if the server can't start it logs a `[QStash Dev]` warning.
 *
 * @example
 * ```ts
 * import { startDevServer } from "@upstash/qstash";
 * await startDevServer();
 * ```
 */
export const startDevServer = async (): Promise<void> => {
  try {
    // eslint-disable-next-line unicorn/no-useless-undefined
    await ensureDevelopmentServer(undefined, undefined);
  } catch (error) {
    console.warn(`${DEV_PREFIX} Could not start dev server:`, error);
  }
};

/**
 * Internal test helper (not part of the public API): stop the spawned dev
 * server, if any, and reset the singleton so the next start spawns fresh.
 * Lets tests release the port between runs.
 */
export const stopDevServer = (): void => {
  stopCurrentServer();
  devServerPromise = undefined;
};

const startPipeline = async (env?: Record<string, string | undefined>): Promise<void> => {
  const baseUrl = getDevUrl(env);
  const port = new URL(baseUrl).port;
  const consoleLink = `\u001B[36m${CONSOLE_URL}?port=${port}\u001B[0m`;

  if (await isDevServerRunning(baseUrl)) {
    console.log(
      `${DEV_PREFIX} Server already running at ${baseUrl}\n${DEV_PREFIX} Console: ${consoleLink}`
    );
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
