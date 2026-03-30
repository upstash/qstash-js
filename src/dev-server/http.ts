import { importHttp, importHttps } from "./constants";

const HTTP_OK = 200;
const HTTP_MULTI_CHOICE = 300;

/**
 * Make an HTTP/HTTPS GET request using node:http/node:https.
 *
 * We intentionally avoid global fetch here because frameworks like Next.js
 * patch it with caching behavior that breaks dev server operations:
 * - Next.js tried to cache the ~12MB binary download, hit a 2MB limit, and errored
 * - Health checks returned stale cached 200s from previous runs, causing the SDK
 *   to skip starting a new server when the old one was dead
 *
 * node:http/node:https bypass all framework fetch patching.
 */
export const nativeGet = async (
  url: string,
  headers?: Record<string, string>,
  timeoutMs?: number
): Promise<{ ok: boolean; statusCode: number; body: Buffer }> => {
  const parsedUrl = new URL(url);
  const httpModule = parsedUrl.protocol === "https:" ? await importHttps() : await importHttp();

  return new Promise((resolve, reject) => {
    const request = httpModule.get(url, { headers }, (response) => {
      const chunks: Uint8Array[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const statusCode = response.statusCode ?? 0;
        resolve({
          ok: statusCode >= HTTP_OK && statusCode < HTTP_MULTI_CHOICE,
          statusCode,
          body: Buffer.concat(chunks),
        });
      });
      response.on("error", reject);
    });

    if (timeoutMs) {
      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error("Request timed out"));
      });
    }

    request.on("error", reject);
  });
};
