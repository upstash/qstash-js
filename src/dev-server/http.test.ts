import { describe, test, expect, afterAll } from "bun:test";
import * as http from "node:http";
import { nativeGet } from "./http";

const HTTP_OK = 200;

describe("nativeGet", () => {
  let server: http.Server;
  let baseUrl: string;

  afterAll(() => {
    server.close();
  });

  test("makes GET request and returns status + body", async () => {
    server = http.createServer((_request, response) => {
      response.writeHead(HTTP_OK, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;

    const { statusCode, body } = await nativeGet(baseUrl);

    expect(statusCode).toBe(HTTP_OK);
    expect(JSON.parse(body.toString())).toEqual({ ok: true });
  });

  test("passes headers through", async () => {
    let receivedAuth = "";
    server.close();
    server = http.createServer((request, response) => {
      receivedAuth = request.headers.authorization ?? "";
      response.writeHead(HTTP_OK);
      response.end("ok");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;

    await nativeGet(baseUrl, { Authorization: "Bearer test-token" });

    expect(receivedAuth).toBe("Bearer test-token");
  });
});
