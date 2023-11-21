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