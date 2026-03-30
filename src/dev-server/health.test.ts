/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-empty-function */

import { describe, test, expect, afterAll } from "bun:test";
import * as http from "node:http";
import { buildNativeGet, isDevServerRunning as isDevelopmentServerRunning } from "./health";
import { DEV_QSTASH_CURRENT_SIGNING_KEY, DEV_QSTASH_NEXT_SIGNING_KEY } from "./constants";

import type { NodeHttps } from "./constants";

const noop = {} as typeof NodeHttps;

describe("buildNativeGet", () => {
  let server: http.Server;
  let baseUrl: string;

  afterAll(() => {
    server.close();
  });

  test("makes GET request and returns status + body", async () => {
    server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;

    const nativeGet = buildNativeGet(http, noop);
    const { statusCode, body } = await nativeGet(baseUrl);

    expect(statusCode).toBe(200);
    expect(JSON.parse(body.toString())).toEqual({ ok: true });
  });

  test("passes headers through", async () => {
    let receivedAuth = "";
    server.close();
    server = http.createServer((request, response) => {
      receivedAuth = request.headers.authorization ?? "";
      response.writeHead(200);
      response.end("ok");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;

    const nativeGet = buildNativeGet(http, noop);
    await nativeGet(baseUrl, { Authorization: "Bearer test-token" });

    expect(receivedAuth).toBe("Bearer test-token");
  });

  // Skipped: bun's node:http compat doesn't fire the 'error' event after
  // req.destroy(err), so the timeout path can't be tested under bun.
  // This works correctly in Node.js.
  test.skip("respects timeout", () => {});
});

describe("isDevServerRunning", () => {
  let server: http.Server;

  afterAll(() => {
    server.close();
  });

  test("returns true when server responds with correct keys", async () => {
    server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          current: DEV_QSTASH_CURRENT_SIGNING_KEY,
          next: DEV_QSTASH_NEXT_SIGNING_KEY,
        })
      );
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };

    const running = await isDevelopmentServerRunning(`http://127.0.0.1:${address.port}`);
    expect(running).toBe(true);
  });

  test("returns false when server responds with wrong keys", async () => {
    server.close();
    server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ current: "wrong", next: "wrong" }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };

    const running = await isDevelopmentServerRunning(`http://127.0.0.1:${address.port}`);
    expect(running).toBe(false);
  });

  test("returns false when server returns non-200", async () => {
    server.close();
    server = http.createServer((_request, response) => {
      response.writeHead(500);
      response.end("error");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };

    const running = await isDevelopmentServerRunning(`http://127.0.0.1:${address.port}`);
    expect(running).toBe(false);
  });

  test("returns false when server is not reachable", async () => {
    const running = await isDevelopmentServerRunning("http://127.0.0.1:1");
    expect(running).toBe(false);
  });
});
