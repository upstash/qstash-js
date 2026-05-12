import type { Runtime } from "./constants";
import { DEV_CREDENTIALS, DEV_PREFIX } from "./constants";
import { nativeGet } from "./http";

const HEALTH_CHECK_TIMEOUT_MS = 2000;

export const isDevServerRunning = async (baseUrl: string): Promise<boolean> => {
  try {
    const { ok, body } = await nativeGet(
      `${baseUrl}/v2/keys`,
      { Authorization: `Bearer ${DEV_CREDENTIALS.token}` },
      HEALTH_CHECK_TIMEOUT_MS
    );

    if (!ok) return false;

    const data = JSON.parse(body.toString()) as {
      current: string;
      next: string;
    };

    return (
      data.current === DEV_CREDENTIALS.currentSigningKey &&
      data.next === DEV_CREDENTIALS.nextSigningKey
    );
  } catch {
    return false;
  }
};

// Dedupe the guidance log: Next.js dev double-invokes routes, which would
// otherwise print the message twice per failed request.
let _didLogUnreachable = false;

export const checkDevServerReachable = async (
  baseUrl: string,
  runtime?: Runtime
): Promise<void> => {
  if (await pingEdge(baseUrl)) return;
  if (!_didLogUnreachable) {
    console.error(unreachableMessage(baseUrl, runtime));
    _didLogUnreachable = true;
  }
  throw new Error(`${DEV_PREFIX} dev server unreachable at ${baseUrl}`);
};

const pingEdge = async (baseUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    const response = await fetch(`${baseUrl}/v2/keys`, {
      headers: { Authorization: `Bearer ${DEV_CREDENTIALS.token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
};

const unreachableMessage = (baseUrl: string, runtime?: Runtime): string => {
  const port = new URL(baseUrl).port;
  const manualStartCmd = `npx @upstash/qstash-cli dev --port ${port}`;
  const header = `\n${DEV_PREFIX} The dev server is not running at ${baseUrl}.\n\n`;

  if (runtime === "cloudflare-workers") {
    return (
      header +
      `Cloudflare Workers cannot start the dev server automatically.\n` +
      `Start it manually before running wrangler dev:\n\n` +
      `  ${manualStartCmd}\n`
    );
  }

  return (
    header +
    `Edge runtimes cannot start the dev server automatically.\n` +
    `Either:\n` +
    `  1. Add the instrumentation hook to start it with your app:\n\n` +
    `     // instrumentation.ts\n` +
    `     import { registerQStashDev } from "@upstash/qstash/nextjs";\n` +
    `     export async function register() { await registerQStashDev(); }\n\n` +
    `  2. Or start it manually:\n\n` +
    `     ${manualStartCmd}\n`
  );
};
