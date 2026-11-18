import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { toDestinationPath, toPathSegment } from "./utils";
import { resend } from "./api/email";

const originalFetch = globalThis.fetch;
const BASE = "https://qstash.example.com";

const captureUrls = () => {
  const urls: string[] = [];
  // The client always calls fetch with a string url.
  globalThis.fetch = ((url: string) => {
    urls.push(url);
    return Promise.resolve(Response.json({ messageId: "msg" }));
  }) as unknown as typeof fetch;
  return urls;
};

const message = (error: unknown) => (error instanceof Error ? error.message : "");

describe("ids and destinations in request paths", () => {
  const client = new Client({ baseUrl: BASE, token: "token", retry: false, devMode: false });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("toPathSegment keeps ordinary ids unchanged", () => {
    for (const id of [
      "msg_abc-123.x~y",
      "user:1@example.com+a=b",
      "order:123",
      "a,b;c&d$e",
      "100%",
      "a b",
    ]) {
      expect(toPathSegment(id)).toBe(id);
    }
  });

  test("toPathSegment rejects ids that do not stay in one segment", () => {
    for (const id of ["a/b", String.raw`a\b`, "a?b", "a#b", "a\tb", "a\nb", "../keys"]) {
      expect(() => toPathSegment(id, "Queue name")).toThrow("Queue name cannot contain");
    }
  });

  test("toPathSegment rejects empty, non-string and dot ids", () => {
    expect(() => toPathSegment("", "Queue name")).toThrow("Queue name cannot be empty");
    expect(() => toPathSegment(["a"] as unknown as string, "Queue name")).toThrow(
      "Queue name must be a string"
    );
    for (const id of [".", "..", "%2e", "%2E%2e", ".%2e", ".\t.", ".. ", " ..", "..\n"]) {
      expect(() => toPathSegment(id, "Queue name")).toThrow('Queue name cannot be "." or ".."');
    }
    for (const id of [" ", "\n", "\t "]) {
      expect(() => toPathSegment(id, "Queue name")).toThrow("Queue name cannot be empty");
    }
  });

  test("toPathSegment removes surrounding whitespace and converts numbers", () => {
    expect(toPathSegment("scd_123\n")).toBe("scd_123");
    expect(toPathSegment(" scd_123 ")).toBe("scd_123");
    expect(toPathSegment("\tscd 123\r\n")).toBe("scd 123");
    expect(toPathSegment(Number("42") as unknown as string)).toBe("42");
    expect(() => toPathSegment(" a/b\n", "Queue name")).toThrow("Queue name cannot contain");
  });

  test("trimmed and numeric ids are sent in one segment", async () => {
    const urls = captureUrls();
    await client.schedules.get("scd_123\n");
    await client.messages.get(Number("42") as unknown as string);
    expect(urls).toEqual([`${BASE}/v2/schedules/scd_123`, `${BASE}/v2/messages/42`]);
  });

  test("toDestinationPath keeps ordinary destinations unchanged", () => {
    for (const destination of [
      "https://example.com",
      "https://example.com/a/b.c?x=../y#z",
      "my-url-group",
      "https://example.com/.well-known/x",
    ]) {
      expect(toDestinationPath(destination)).toBe(destination);
    }
  });

  test("toDestinationPath resolves dot segments within a url", () => {
    const cases: [string, string][] = [
      ["https://example.com/a/../b", "https://example.com/b"],
      ["https://example.com/api/../hook?x=1#y", "https://example.com/hook?x=1#y"],
      ["https://example.com/./a", "https://example.com/a"],
      ["https://example.com/%2e%2e/a", "https://example.com/a"],
      ["https://example.com/../../../keys", "https://example.com/keys"],
      [String.raw`https://example.com\..\a`, "https://example.com/a"],
      ["https://example.com/a/.\t./b", "https://example.com/b"],
    ];
    for (const [destination, resolved] of cases) {
      expect(toDestinationPath(destination)).toBe(resolved);
    }
  });

  test("toDestinationPath rejects dot segments outside a url", () => {
    for (const destination of ["..", "../keys", "group/../../keys", "./group", "ftp://x/../a"]) {
      expect(() => toDestinationPath(destination)).toThrow("path segments");
    }
  });

  test("ids are sent as they are", async () => {
    const urls = captureUrls();
    await client.messages.get("order:123");
    await client.schedules.get("user@example.com");
    await client.queue({ queueName: "a+b=c" }).get();
    expect(urls).toEqual([
      `${BASE}/v2/messages/order:123`,
      `${BASE}/v2/schedules/user@example.com`,
      `${BASE}/v2/queues/a+b=c`,
    ]);
  });

  test("does not send a request for an id with a path separator", async () => {
    const urls = captureUrls();
    const results = await Promise.all([
      client.messages.get("a/b").then(() => "", message),
      client.messages.cancel("../messages").then(() => "", message),
      client.schedules.get("a?b").then(() => "", message),
      client
        .queue({ queueName: "a#b" })
        .get()
        .then(() => "", message),
      client.urlGroups.get("a/b").then(() => "", message),
      client.flowControl.get("a/b").then(() => "", message),
    ]);
    for (const result of results) expect(result).toContain("cannot contain");
    expect(urls).toEqual([]);
  });

  test("does not send a request for a dot id or destination", async () => {
    const urls = captureUrls();
    expect(await client.messages.get("..").then(() => "", message)).toBe(
      'Message id cannot be "." or ".."'
    );
    expect(await client.publish({ url: "../keys" }).then(() => "", message)).toContain(
      "path segments"
    );
    expect(urls).toEqual([]);
  });

  test("a url destination with dot segments stays under the publish endpoint", async () => {
    const urls = captureUrls();
    await client.publish({ url: "https://example.com/a/../b" });
    await client.publish({ url: "https://example.com/../../../../keys/rotate" });
    expect(urls).toEqual([
      `${BASE}/v2/publish/https://example.com/b`,
      `${BASE}/v2/publish/https://example.com/keys/rotate`,
    ]);
  });

  test("publish destination is sent as before", async () => {
    const urls = captureUrls();
    await client.publish({ url: "https://example.com/a/b?x=1" });
    expect(urls).toEqual([`${BASE}/v2/publish/https://example.com/a/b?x=1`]);
  });

  test("toDestinationPath converts objects to strings before checking them", () => {
    const url = new URL("https://example.com/a/b");
    expect(toDestinationPath(url as unknown as string)).toBe("https://example.com/a/b");
    const endpoint = { toString: () => "https://example.com/hook" };
    expect(toDestinationPath(endpoint as unknown as string)).toBe("https://example.com/hook");
    const lookalike = { replaceAll: () => "ok", toString: () => "../keys" };
    expect(() => toDestinationPath(lookalike as unknown as string)).toThrow("path segments");
    expect(() => toDestinationPath(undefined as unknown as string)).toThrow("must be a string");
  });

  test("toDestinationPath rejects destinations without a path", () => {
    for (const destination of ["", " ", "\n", "#", "?", "?x=1", "#/../../keys"]) {
      expect(() => toDestinationPath(destination)).toThrow("Destination cannot be empty");
    }
  });

  test("email provider base url is checked", async () => {
    const urls = captureUrls();
    const provider = resend({ token: "t" });
    (provider as { baseUrl: string }).baseUrl = "../keys";
    expect(
      await client.publish({ api: { name: "email", provider }, body: "x" }).then(() => "", message)
    ).toContain("path segments");
    expect(urls).toEqual([]);
  });

  test("batch destinations are sent in the body as they are", async () => {
    const urls = captureUrls();
    await client.batch([{ url: "https://example.com/a/../b" }]);
    expect(urls).toEqual([`${BASE}/v2/batch`]);
  });
});
