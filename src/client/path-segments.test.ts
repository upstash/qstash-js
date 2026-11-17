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
    for (const id of [
      "a/b",
      String.raw`a\b`,
      "a?b",
      "a#b",
      "a\tb",
      "a\nb",
      " a",
      "a ",
      "../keys",
    ]) {
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

  test("toDestinationPath rejects dot segments", () => {
    for (const destination of [
      "https://example.com/a/../b",
      "https://example.com/./a",
      "https://example.com/%2e%2e/a",
      String.raw`https://example.com\..\a`,
      "https://example.com/a/.. ",
      "https://example.com/a/.\t./b",
      "..",
    ]) {
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
    expect(
      await client.publish({ url: "https://example.com/a/../b" }).then(() => "", message)
    ).toContain("path segments");
    expect(urls).toEqual([]);
  });

  test("publish destination is sent as before", async () => {
    const urls = captureUrls();
    await client.publish({ url: "https://example.com/a/b?x=1" });
    expect(urls).toEqual([`${BASE}/v2/publish/https://example.com/a/b?x=1`]);
  });

  test("toDestinationPath accepts URL objects and rejects other values", () => {
    const url = new URL("https://example.com/a/b");
    expect(toDestinationPath(url as unknown as string)).toBe("https://example.com/a/b");
    const lookalike = { replaceAll: () => "ok", toString: () => "../keys" };
    expect(() => toDestinationPath(lookalike as unknown as string)).toThrow("must be a string");
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
