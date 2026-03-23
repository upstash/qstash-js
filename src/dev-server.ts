/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable no-console */

const DEFAULT_DEV_PORT = 8642;
const DEV_QSTASH_TOKEN = "eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=";
const DEV_QSTASH_CURRENT_SIGNING_KEY = "sig_7kYjw48mhY7kAjqNGcy6cr29RJ6r";
const DEV_QSTASH_NEXT_SIGNING_KEY = "sig_5ZB6DVzB1wjE8S6rZ7eenA8Pdnhs";

const GITHUB_RELEASES_URL = "https://api.github.com/repos/upstash/qstash-cli/releases/latest";
const BINARY_URL_BASE = "https://artifacts.upstash.com/qstash/versions";
const CONSOLE_URL = "https://console.upstash.com/qstash/local-mode-user";

type DevCredentials = {
  token: string;
  currentSigningKey: string;
  nextSigningKey: string;
  baseUrl: string;
};

type Runtime = "nodejs" | "edge" | "cloudflare-workers" | "browser";

/**
 * Detect the current JS runtime environment.
 */
const getRuntime = (): Runtime => {
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

// All Node.js built-in imports use template literal concatenation so that
// edge bundlers (Next.js, Vercel, Cloudflare) cannot statically resolve them.
// These imports are only reached in Node.js runtimes.

import type * as NodeHttp from "node:http";
import type * as NodeHttps from "node:https";
import type * as NodeFs from "node:fs";
import type * as NodeChildProcess from "node:child_process";
import type * as NodeOs from "node:os";

// Dynamic imports use a helper to prevent edge bundlers from statically resolving them.
const _n = (m: string) => `node:${m}`;
const importHttp = (): Promise<typeof NodeHttp> => import(/* webpackIgnore: true */ _n("http"));
const importHttps = (): Promise<typeof NodeHttps> => import(/* webpackIgnore: true */ _n("https"));
const importFs = (): Promise<typeof NodeFs> => import(/* webpackIgnore: true */ _n("fs"));
const importChildProcess = (): Promise<typeof NodeChildProcess> =>
  import(/* webpackIgnore: true */ _n("child_process"));
const importOs = (): Promise<typeof NodeOs> => import(/* webpackIgnore: true */ _n("os"));

/**
 * Make an HTTP/HTTPS GET request using node:http/node:https.
 * Bypasses framework fetch patching (Next.js, Nuxt, etc.).
 */
let _nativeGet:
  | ((
      url: string,
      headers?: Record<string, string>,
      timeoutMs?: number
    ) => Promise<{ statusCode: number; body: Buffer }>)
  | undefined;

const getNativeGet = async () => {
  if (_nativeGet) return _nativeGet;
  const http = await importHttp();
  const https = await importHttps();

  _nativeGet = (url, headers, timeoutMs) => {
    const parsedUrl = new URL(url);
    const mod = parsedUrl.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
      const req = mod.get(url, { headers }, (res) => {
        const chunks: Uint8Array[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", reject);
      });

      if (timeoutMs) {
        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error("Request timed out"));
        });
      }

      req.on("error", reject);
    });
  };

  return _nativeGet;
};

/**
 * Get the dev server URL from environment or use default.
 */
const getDevUrl = (env?: Record<string, string | undefined>): string => {
  const portStr = env?.QSTASH_DEV_PORT ?? getProcessEnv("QSTASH_DEV_PORT");
  let port = DEFAULT_DEV_PORT;
  if (portStr) {
    const parsed = Number.parseInt(portStr, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      port = parsed;
    }
  }
  console.log(`[QStash Dev][DEBUG] getDevUrl: port=${port}`);
  return `http://127.0.0.1:${port}`;
};

/**
 * Get dev server credentials.
 */
export const getDevelopmentCredentials = (
  env?: Record<string, string | undefined>
): DevCredentials => {
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
  console.log(
    `[QStash Dev][DEBUG] ensureDevelopmentServer called, devMode=${devMode}, runtime=${runtime}`
  );
  if (runtime !== "nodejs") {
    console.log(`[QStash Dev][DEBUG] ${runtime} runtime detected, skipping auto-start`);
    // If dev mode is active, verify the server is reachable — otherwise
    // the user will get an unhelpful "fetch failed" error later.
    if (shouldUseDevelopmentMode(devMode, env)) {
      return checkDevServerReachable(env, runtime);
    }
    return Promise.resolve();
  }
  if (!shouldUseDevelopmentMode(devMode, env)) {
    console.log(`[QStash Dev][DEBUG] dev mode not enabled, skipping`);
    return Promise.resolve();
  }
  if (devServerPromise) {
    console.log(`[QStash Dev][DEBUG] devServerPromise already exists, returning existing`);
    return devServerPromise;
  }
  console.log(`[QStash Dev][DEBUG] no existing promise, starting pipeline`);
  devServerPromise = startPipeline(env).catch((error: unknown) => {
    console.log(`[QStash Dev][DEBUG] startPipeline failed:`, error);
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
    console.log(`[QStash Dev][DEBUG] shouldUseDevelopmentMode: explicit devMode=${devMode}`);
    return devMode;
  }
  const value = env?.QSTASH_DEV ?? getProcessEnv("QSTASH_DEV");
  console.log(`[QStash Dev][DEBUG] shouldUseDevelopmentMode: QSTASH_DEV=${value}`);
  if (value === undefined) return false;
  if (value === "true" || value === "1" || value === "") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`[QStash Dev] Invalid value for QSTASH_DEV in enviroment: ${value}`);
};

const getProcessEnv = (key: string): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof process !== "undefined" && process.env) return process.env[key];
  return undefined;
};

const fetchLatestVersion = async (): Promise<string> => {
  console.log(`[QStash Dev][DEBUG] fetchLatestVersion: fetching from ${GITHUB_RELEASES_URL}`);
  const nativeGet = await getNativeGet();
  const { statusCode, body } = await nativeGet(GITHUB_RELEASES_URL, {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "upstash-qstash-js",
  });

  console.log(`[QStash Dev][DEBUG] fetchLatestVersion: status=${statusCode}`);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`[QStash Dev] Failed to fetch latest version: HTTP ${statusCode}`);
  }

  const data = JSON.parse(body.toString()) as { tag_name: string };
  console.log(`[QStash Dev][DEBUG] fetchLatestVersion: tag_name=${data.tag_name}`);
  return data.tag_name.replace(/^v/, "");
};

const findCacheDirectory = async (): Promise<string> => {
  const fs = await importFs();
  const os = await importOs();

  const home = os.homedir();
  const platform = os.platform();

  // Use OS-standard cache directories so the binary is shared across projects.
  const base =
    platform === "darwin"
      ? `${home}/Library/Caches/upstash`
      : `${home}/.cache/upstash`;
  const cacheDir = `${base}/qstash-dev`;

  console.log(`[QStash Dev][DEBUG] findCacheDirectory: cacheDir=${cacheDir}`);
  await fs.promises.mkdir(cacheDir, { recursive: true });
  return cacheDir;
};

const downloadBinary = async (version: string, cacheDir: string): Promise<string> => {
  const fs = await importFs();
  const childProcess = await importChildProcess();
  const os = await importOs();

  const platform = os.platform() === "darwin" ? "darwin" : "linux";
  const arch = os.arch() === "arm64" ? "arm64" : "amd64";

  const tarballName = `qstash-server_${version}_${platform}_${arch}`;
  const binaryPath = `${cacheDir}/qstash`;

  const versionFile = `${cacheDir}/.version`;

  console.log(`[QStash Dev][DEBUG] downloadBinary: platform=${platform}, arch=${arch}`);
  console.log(`[QStash Dev][DEBUG] downloadBinary: binaryPath=${binaryPath}`);

  // Check if cached binary is already the right version
  if (fs.existsSync(binaryPath) && fs.existsSync(versionFile)) {
    const cachedVersion = fs.readFileSync(versionFile, "utf-8").trim();
    if (cachedVersion === version) {
      console.log(`[QStash Dev][DEBUG] downloadBinary: v${version} already cached, skipping download`);
      return binaryPath;
    }
    console.log(`[QStash Dev][DEBUG] downloadBinary: outdated v${cachedVersion}, upgrading to v${version}`);
    fs.unlinkSync(binaryPath);
  }

  const tarballUrl = `${BINARY_URL_BASE}/${version}/${tarballName}.tar.gz`;
  console.log(`[QStash Dev] Downloading dev server v${version}...`);
  console.log(`[QStash Dev][DEBUG] downloadBinary: tarballUrl=${tarballUrl}`);

  const nativeGet = await getNativeGet();
  const { statusCode, body } = await nativeGet(tarballUrl);
  console.log(`[QStash Dev][DEBUG] downloadBinary: fetch status=${statusCode}`);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`[QStash Dev] Failed to download binary: HTTP ${statusCode}`);
  }

  const tarballPath = `${cacheDir}/${tarballName}.tar.gz`;
  console.log(`[QStash Dev][DEBUG] downloadBinary: downloaded ${body.byteLength} bytes`);
  await fs.promises.writeFile(tarballPath, new Uint8Array(body));

  console.log(`[QStash Dev][DEBUG] downloadBinary: extracting tarball`);
  childProcess.execSync(`tar -xzf "${tarballPath}" -C "${cacheDir}"`, { stdio: "pipe" });

  await fs.promises.chmod(binaryPath, 0o755);

  await fs.promises.writeFile(versionFile, version);
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await fs.promises.unlink(tarballPath).catch(() => {});
  console.log(`[QStash Dev][DEBUG] downloadBinary: cleanup done, binaryPath=${binaryPath}`);

  return binaryPath;
};

/**
 * Quick health check using global fetch (works in edge runtimes).
 * Logs a descriptive error once if the dev server is not reachable.
 */
let _edgeCheckPromise: Promise<void> | undefined;
const checkDevServerReachable = (
  env?: Record<string, string | undefined>,
  runtime?: Runtime
): Promise<void> => {
  if (_edgeCheckPromise) return _edgeCheckPromise;
  _edgeCheckPromise = _doCheckDevServerReachable(env, runtime);
  return _edgeCheckPromise;
};
const _doCheckDevServerReachable = async (
  env?: Record<string, string | undefined>,
  runtime?: Runtime
): Promise<void> => {
  const baseUrl = getDevUrl(env);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2000);
    const res = await fetch(`${baseUrl}/v2/keys`, {
      headers: { Authorization: `Bearer ${DEV_QSTASH_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) return;
  } catch {
    // Server not reachable — fall through to warning
  }

  const port = getPortFromUrl(baseUrl);
  const manualStartCmd = `npx @upstash/qstash-cli dev --port ${port}`;

  if (runtime === "cloudflare-workers") {
    console.error(
      `\n[QStash Dev] The dev server is not running at ${baseUrl}.\n\n` +
        `Cloudflare Workers cannot start the dev server automatically.\n` +
        `Start it manually before running wrangler dev:\n\n` +
        `  ${manualStartCmd}\n`
    );
  } else {
    console.error(
      `\n[QStash Dev] The dev server is not running at ${baseUrl}.\n\n` +
        `Edge runtimes cannot start the dev server automatically.\n` +
        `Either:\n` +
        `  1. Add the instrumentation hook to start it with your app:\n\n` +
        `     // instrumentation.ts\n` +
        `     import { registerQStashDev } from "@upstash/qstash/nextjs";\n` +
        `     export async function register() { await registerQStashDev(); }\n\n` +
        `  2. Or start it manually:\n\n` +
        `     ${manualStartCmd}\n`
    );
  }
};

const isDevServerRunning = async (baseUrl: string): Promise<boolean> => {
  console.log(`[QStash Dev][DEBUG] isDevServerRunning: checking ${baseUrl}/v2/keys`);
  try {
    const nativeGet = await getNativeGet();
    const { statusCode, body } = await nativeGet(
      `${baseUrl}/v2/keys`,
      { Authorization: `Bearer ${DEV_QSTASH_TOKEN}` },
      2000
    );

    console.log(`[QStash Dev][DEBUG] isDevServerRunning: status=${statusCode}`);
    if (statusCode < 200 || statusCode >= 300) {
      console.log(`[QStash Dev][DEBUG] isDevServerRunning: not ok, returning false`);
      return false;
    }

    const data = JSON.parse(body.toString()) as {
      current: string;
      next: string;
    };

    const match =
      data.current === DEV_QSTASH_CURRENT_SIGNING_KEY && data.next === DEV_QSTASH_NEXT_SIGNING_KEY;
    console.log(
      `[QStash Dev][DEBUG] isDevServerRunning: keys match=${match}, current=${data.current}, next=${data.next}`
    );
    return match;
  } catch (error) {
    console.log(
      `[QStash Dev][DEBUG] isDevServerRunning: error=${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
};

type ChildProcess = {
  kill: (signal?: NodeJS.Signals | number) => boolean;
  pid?: number;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
};

const getPortFromUrl = (url: string): string => {
  return new URL(url).port;
};

const spawnServer = async (binaryPath: string, port: string): Promise<ChildProcess> => {
  const childProcess = await importChildProcess();
  console.log(`[QStash Dev][DEBUG] spawnServer: binaryPath=${binaryPath}, port=${port}`);
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = childProcess.spawn(binaryPath, ["dev", "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    console.log(`[QStash Dev][DEBUG] spawnServer: spawned pid=${child.pid}`);

    const timeout = setTimeout(() => {
      console.log(`[QStash Dev][DEBUG] spawnServer: TIMEOUT after 30s, killing child`);
      child.kill();
      reject(new Error("[QStash Dev] Server failed to start within 30 seconds"));
    }, 30_000);

    let stderrOutput = "";
    let stdoutOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      stdoutOutput += output;
      console.log(`[QStash Dev][DEBUG] spawnServer stdout: ${output.trim()}`);
      if (/runn+ing at/i.test(output)) {
        console.log(`[QStash Dev][DEBUG] spawnServer: detected "running at" in stdout, resolving`);
        clearTimeout(timeout);
        resolve(child);
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      stderrOutput += output;
      console.log(`[QStash Dev][DEBUG] spawnServer stderr: ${output.trim()}`);
    });

    child.on("error", (error: Error) => {
      console.log(`[QStash Dev][DEBUG] spawnServer: error event: ${error.message}`);
      clearTimeout(timeout);
      reject(new Error(`[QStash Dev] Failed to start server: ${error.message}`));
    });

    child.on("exit", (code: number | null, signal: string | null) => {
      console.log(`[QStash Dev][DEBUG] spawnServer: exit event: code=${code}, signal=${signal}`);
      console.log(`[QStash Dev][DEBUG] spawnServer: full stdout was: ${stdoutOutput}`);
      console.log(`[QStash Dev][DEBUG] spawnServer: full stderr was: ${stderrOutput}`);
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        reject(
          new Error(
            `[QStash Dev] Server exited with code ${code}${stderrOutput ? `: ${stderrOutput}` : ""}`
          )
        );
      }
    });
  });
};

const registerCleanup = (child: ChildProcess): void => {
  console.log(`[QStash Dev][DEBUG] registerCleanup: registering for pid=${child.pid}`);
  const cleanup = () => {
    try {
      console.log(`[QStash Dev][DEBUG] cleanup: killing pid=${child.pid}`);
      child.kill("SIGTERM" as NodeJS.Signals);
    } catch {
      // Process may already be dead
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
};

const startPipeline = async (env?: Record<string, string | undefined>): Promise<void> => {
  console.log(`[QStash Dev][DEBUG] startPipeline: begin`);
  const baseUrl = getDevUrl(env);

  if (await isDevServerRunning(baseUrl)) {
    console.log(
      `[QStash Dev] Server already running at ${baseUrl}\n` +
        `  Console: \u001B[36m${CONSOLE_URL}?port=${getPortFromUrl(baseUrl)}\u001B[0m\n`
    );
    return;
  }

  console.log(`[QStash Dev][DEBUG] startPipeline: finding cache directory`);
  const cacheDir = await findCacheDirectory();

  console.log(`[QStash Dev][DEBUG] startPipeline: fetching latest version`);
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
        ? fs.readFileSync(versionFile, "utf-8").trim()
        : "unknown";
      console.log(
        `[QStash Dev] Could not check for updates, using cached v${cachedVersion}`
      );
      version = cachedVersion;
    } else {
      throw error;
    }
  }
  console.log(`[QStash Dev][DEBUG] startPipeline: version=${version}`);
  console.log(`[QStash Dev][DEBUG] startPipeline: cacheDir=${cacheDir}`);

  console.log(`[QStash Dev][DEBUG] startPipeline: downloading binary`);
  const binaryPath = await downloadBinary(version, cacheDir);
  console.log(`[QStash Dev][DEBUG] startPipeline: binaryPath=${binaryPath}`);

  console.log(
    `[QStash Dev][DEBUG] startPipeline: spawning server on port ${getPortFromUrl(baseUrl)}`
  );
  const child = await spawnServer(binaryPath, getPortFromUrl(baseUrl));
  console.log(`[QStash Dev][DEBUG] startPipeline: server spawned, pid=${child.pid}`);

  registerCleanup(child);

  console.log(
    `[QStash Dev] Server ready at ${baseUrl}\n` +
      `  Console: \u001B[36m${CONSOLE_URL}?port=${getPortFromUrl(baseUrl)}\u001B[0m\n`
  );
};
