/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable no-console */

import type { Runtime, NodeHttp, NodeHttps } from "./constants";
import {
  DEV_QSTASH_TOKEN,
  DEV_QSTASH_CURRENT_SIGNING_KEY,
  DEV_QSTASH_NEXT_SIGNING_KEY,
  importHttp,
  importHttps,
} from "./constants";
/**
 * Make an HTTP/HTTPS GET request using node:http/node:https.
 * Bypasses framework fetch patching (Next.js, Nuxt, etc.).
 */
type NativeGetFunction = (
  url: string,
  headers?: Record<string, string>,
  timeoutMs?: number
) => Promise<{ statusCode: number; body: Buffer }>;

let _nativeGet: NativeGetFunction | undefined;

export const getNativeGet = async (): Promise<NativeGetFunction> => {
  if (_nativeGet) return _nativeGet;
  const http = await importHttp();
  const https = await importHttps();

  _nativeGet = buildNativeGet(http, https);

  return _nativeGet;
};

export const buildNativeGet = (
  http: typeof NodeHttp,
  https: typeof NodeHttps
): NativeGetFunction => {
  return (
    url: string,
    headers?: Record<string, string>,
    timeoutMs?: number
  ): Promise<{ statusCode: number; body: Buffer }> => {
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
};

export const isDevServerRunning = async (baseUrl: string): Promise<boolean> => {
  try {
    const nativeGet = await getNativeGet();
    const { statusCode, body } = await nativeGet(
      `${baseUrl}/v2/keys`,
      { Authorization: `Bearer ${DEV_QSTASH_TOKEN}` },
      2000
    );

    if (statusCode < 200 || statusCode >= 300) {
      return false;
    }

    const data = JSON.parse(body.toString()) as {
      current: string;
      next: string;
    };

    return (
      data.current === DEV_QSTASH_CURRENT_SIGNING_KEY && data.next === DEV_QSTASH_NEXT_SIGNING_KEY
    );
  } catch {
    return false;
  }
};

/**
 * Quick health check using global fetch (works in edge runtimes).
 * Logs a descriptive error once if the dev server is not reachable.
 */
let _edgeCheckPromise: Promise<void> | undefined;
export const checkDevServerReachable = (baseUrl: string, runtime?: Runtime): Promise<void> => {
  if (_edgeCheckPromise) return _edgeCheckPromise;
  _edgeCheckPromise = _doCheckDevServerReachable(baseUrl, runtime);
  return _edgeCheckPromise;
};
const _doCheckDevServerReachable = async (baseUrl: string, runtime?: Runtime): Promise<void> => {
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

  const port = new URL(baseUrl).port;
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

/** Reset the singleton for testing */
export const _resetEdgeCheck = () => {
  _edgeCheckPromise = undefined;
};
