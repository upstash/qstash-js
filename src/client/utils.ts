import type { PublishRequest } from "./client";

const isIgnoredHeader = (header: string) => {
  const lowerCaseHeader = header.toLowerCase();
  return lowerCaseHeader.startsWith("content-type") || lowerCaseHeader.startsWith("upstash-");
};

export function prefixHeaders(headers: Headers) {
  // Get keys of headers that need to be prefixed
  const keysToBePrefixed = [...headers.keys()].filter((key) => !isIgnoredHeader(key));

  // Add the prefixed headers
  for (const key of keysToBePrefixed) {
    const value = headers.get(key);
    if (value !== null) {
      headers.set(`Upstash-Forward-${key}`, value);
    }
    headers.delete(key); // clean up non-prefixed headers
  }

  return headers;
}

export function processHeaders(request: PublishRequest) {
  //@ts-expect-error caused by undici and bunjs type overlap
  const headers = prefixHeaders(new Headers(request.headers));

  headers.set("Upstash-Method", request.method ?? "POST");

  if (request.delay !== undefined) {
    headers.set("Upstash-Delay", `${request.delay.toFixed(0)}s`);
  }

  if (request.notBefore !== undefined) {
    headers.set("Upstash-Not-Before", request.notBefore.toFixed(0));
  }

  if (request.deduplicationId !== undefined) {
    headers.set("Upstash-Deduplication-Id", request.deduplicationId);
  }

  if (request.contentBasedDeduplication !== undefined) {
    headers.set("Upstash-Content-Based-Deduplication", "true");
  }

  if (request.retries !== undefined) {
    headers.set("Upstash-Retries", request.retries.toFixed(0));
  }

  if (request.callback !== undefined) {
    headers.set("Upstash-Callback", request.callback);
  }

  if (request.failureCallback !== undefined) {
    headers.set("Upstash-Failure-Callback", request.failureCallback);
  }

  if (request.timeout !== undefined) {
    headers.set("Upstash-Timeout", `${request.timeout}s`);
  }

  return headers;
}

export function getRequestPath(request: Pick<PublishRequest, "url" | "urlGroup" | "api">): string {
  return request.url ?? request.urlGroup ?? `api/${request.api?.name}`;
}
