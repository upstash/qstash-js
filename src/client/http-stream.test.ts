/* eslint-disable @typescript-eslint/no-magic-numbers */
import { expect, test } from "bun:test";
import { createServer } from "node:http";
import type { RequestListener } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "./client";

const encoder = new TextEncoder();
const destination = "https://destination.example.invalid/hook";
const withServer = async (handler: RequestListener, run: (baseUrl: string) => Promise<void>) => {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No server port assigned");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
      server.closeAllConnections();
    });
  }
};
const makeClient = (baseUrl: string, retries = 1) =>
  new Client({
    baseUrl,
    token: "offline-fixture",
    devMode: false,
    enableTelemetry: false,
    retry: { retries, backoff: () => 0 },
  });
for (const method of ["publish", "enqueue", "schedule"] as const) {
  test(`replays identical stream bytes after ${method} transport failure`, async () => {
    const payload = "alpha:☃\nβeta:42\n";
    const received: string[] = [];
    await withServer(
      (request, response) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => {
          received.push(Buffer.concat(chunks).toString());
          if (received.length === 1) request.socket.destroy();
          else
            response.end(
              JSON.stringify(method === "schedule" ? { scheduleId: "ok" } : { messageId: "ok" })
            );
        });
      },
      async (baseUrl) => {
        const client = makeClient(baseUrl);
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(payload));
            controller.close();
          },
        });
        const request = { url: destination, body };
        if (method === "publish") await client.publish(request);
        if (method === "enqueue") await client.queue({ queueName: "offline" }).enqueue(request);
        if (method === "schedule")
          await client.schedules.create({ destination, body, cron: "0 0 * * *" });
        expect(received).toEqual([payload, payload]);
      }
    );
  });
}
for (const succeeds of [true, false]) {
  test(`stops an open upload after ${succeeds ? "an early response" : "retry exhaustion"}`, async () => {
    let canceled = false;
    let pulls = 0;
    let attempts = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          pulls++;
          await delay(10);
          if (!canceled) controller.enqueue(encoder.encode("chunk"));
        },
        cancel() {
          canceled = true;
        },
      },
      { highWaterMark: 0 }
    );
    await withServer(
      (request, response) =>
        request.once("data", () => {
          attempts++;
          if (succeeds) response.end('{"messageId":"ok"}');
          else request.socket.destroy();
        }),
      async (baseUrl) => {
        const result: unknown = await makeClient(baseUrl, 2)
          .publish({ url: destination, body })
          .catch((error: unknown) => error);
        if (succeeds) expect(result).toEqual({ messageId: "ok" });
        else expect(result).toBeInstanceOf(Error);
        await delay(30);
        expect(attempts).toBe(succeeds ? 1 : 3);
        expect(canceled).toBe(true);
        const stoppedAt = pulls;
        await delay(30);
        expect(pulls).toBe(stoppedAt);
      }
    );
  });
}
for (const kind of ["Uint8Array", "Buffer"])
  test(`retains a snapshot when the source reuses a ${kind}`, async () => {
    const bytes = kind === "Buffer" ? Buffer.alloc(5) : new Uint8Array(5);
    let part = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          await delay(5);
          bytes.fill(++part);
          controller.enqueue(bytes);
          if (part === 3) controller.close();
        },
      },
      { highWaterMark: 0 }
    );
    const received: string[] = [];
    await withServer(
      (request, response) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => {
          received.push(Buffer.concat(chunks).toString("hex"));
          if (received.length === 1) request.socket.destroy();
          else response.end('{"messageId":"ok"}');
        });
      },
      async (baseUrl) => {
        await makeClient(baseUrl).publish({ url: destination, body });
        expect(received).toEqual([
          "010101010102020202020303030303",
          "010101010102020202020303030303",
        ]);
      }
    );
  });
