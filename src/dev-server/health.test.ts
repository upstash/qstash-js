import { describe, test, expect, afterAll } from "bun:test";
import * as http from "node:http";
import { isDevServerRunning as isDevelopmentServerRunning } from "./health";
import { DEV_CREDENTIALS } from "./constants";

const HTTP_OK = 200;
const HTTP_INTERNAL_ERROR = 500;

describe("isDevServerRunning", () => {
  let server: http.Server;

  afterAll(() => {
    server.close();
  });

  test("returns true when server responds with correct keys", async () => {
    server = http.createServer((_request, response) => {
      response.writeHead(HTTP_OK, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          current: DEV_CREDENTIALS.currentSigningKey,
          next: DEV_CREDENTIALS.nextSigningKey,
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

  test("returns false when server returns non-200", async () => {
    server.close();
    server = http.createServer((_request, response) => {
      response.writeHead(HTTP_INTERNAL_ERROR);
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
