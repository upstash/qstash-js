/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { sleep } from "bun";
import type { MessageDetails } from "../../proxy-server/server";

const DELAY = 3000;
describe("Client", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should publish a message",
    async () => {
      const result = await client.publishJSON({
        url: "https://cookie-jar-103-181-222-27.loca.lt/message",
        body: { hello: "world" },
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
      });

      await sleep(DELAY);

      const proxy = await fetch(
        `http://localhost:4000/publish-verify?messageId=${result.messageId}`
      );
      const json = (await proxy.json()) as MessageDetails;

      expect(result.messageId).toBe(json.headers["upstash-message-id"] as string);
      expect(json.headers["test-header"]).toBe("test-value");
      expect(json.body).toEqual(JSON.stringify({ hello: "world" }));
    },
    { retry: 0 }
  );
});
