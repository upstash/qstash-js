import type { PublishRequest } from "./client";

export function prefixHeaders(headers: Headers) {
  const isIgnoredHeader = (header: string) => {
    const lowerCaseHeader = header.toLowerCase();
    return (
      lowerCaseHeader.startsWith("content-type") ||
      lowerCaseHeader.startsWith("upstash-")
    );
  };

  // Get keys of headers that need to be prefixed
  const keysToBePrefixed = Array.from(headers.keys()).filter(
    (key) => !isIgnoredHeader(key)
  );

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

export function processHeaders(req: PublishRequest) {
  const headers = prefixHeaders(new Headers(req.headers));

  headers.set("Upstash-Method", req.method ?? "POST");

  if (typeof req.delay !== "undefined") {
    headers.set("Upstash-Delay", `${req.delay.toFixed()}s`);
  }

  if (typeof req.notBefore !== "undefined") {
    headers.set("Upstash-Not-Before", req.notBefore.toFixed());
  }

  if (typeof req.deduplicationId !== "undefined") {
    headers.set("Upstash-Deduplication-Id", req.deduplicationId);
  }

  if (typeof req.contentBasedDeduplication !== "undefined") {
    headers.set("Upstash-Content-Based-Deduplication", "true");
  }

  if (typeof req.retries !== "undefined") {
    headers.set("Upstash-Retries", req.retries.toFixed());
  }

  if (typeof req.callback !== "undefined") {
    headers.set("Upstash-Callback", req.callback);
  }

  if (typeof req.failureCallback !== "undefined") {
    headers.set("Upstash-Failure-Callback", req.failureCallback);
  }

  return headers;
}
