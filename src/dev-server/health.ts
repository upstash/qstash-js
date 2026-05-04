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
    }, HEALTH_CHECK_TIMEOUT_MS);
    const response = await fetch(`${baseUrl}/v2/keys`, {
      headers: { Authorization: `Bearer ${DEV_CREDENTIALS.token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) return;
  } catch {
    // Server not reachable — fall through to warning
  }

  const port = new URL(baseUrl).port;
  const manualStartCmd = `npx @upstash/qstash-cli dev --port ${port}`;

  if (runtime === "cloudflare-workers") {
    console.error(
      `\n${DEV_PREFIX} The dev server is not running at ${baseUrl}.\n\n` +
        `Cloudflare Workers cannot start the dev server automatically.\n` +
        `Start it manually before running wrangler dev:\n\n` +
        `  ${manualStartCmd}\n`
    );
  } else {
    console.error(
      `\n${DEV_PREFIX} The dev server is not running at ${baseUrl}.\n\n` +
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
