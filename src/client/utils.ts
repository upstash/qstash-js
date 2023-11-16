export function prefixHeaders(headers: Headers) {
  const ignoredHeaders = new Set([
    "content-type",
    "upstash-cron",
    "upstash-method",
    "upstash-delay",
    "upstash-not-before",
    "upstash-Deduplication-id",
    "upstash-content-based-deduplication",
    "upstash-retries",
    "upstash-callback",
    "upstash-failure-callback",
  ]);

  // Get keys of headers that need to be prefixed
  const keysToBePrefixed = Array.from(headers.keys()).filter(
    (key) =>
      !ignoredHeaders.has(key.toLowerCase()) &&
      !key.toLowerCase().startsWith("upstash-forward-")
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
