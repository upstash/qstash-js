import { Client } from "@upstash/qstash";
import { test, expect } from "bun:test";

// End-to-end delivery round trip. The app publishes a message to its own
// /roundtrip/verify endpoint (which runs verifySignatureAppRouter), QStash
// delivers the signed request, and we poll the message logs until QStash
// reports it as DELIVERED.
//
// Requires a publicly reachable deployment, so this only runs in the deployed
// CI job.
const deploymentURL = process.env.DEPLOYMENT_URL;
if (!deploymentURL) {
  throw new Error("DEPLOYMENT_URL not set");
}

const token = process.env.QSTASH_TOKEN;
if (!token) {
  throw new Error("QSTASH_TOKEN not set");
}

// Endpoints that verify the QStash signature. Hitting them directly (without a
// valid Upstash-Signature header) must be rejected, never answered with 200.
const VERIFIED_ENDPOINTS = ["/roundtrip/verify", "/serverless", "/edge"];

test("verified endpoints reject unsigned requests", async () => {
  for (const path of VERIFIED_ENDPOINTS) {
    const res = await fetch(`${deploymentURL}${path}`, {
      method: "POST",
      body: JSON.stringify({ hello: "no signature" }),
    });

    // verifySignatureAppRouter returns 403 when the signature header is missing.
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(403);
  }
});

test(
  "publishes to the verify endpoint and the message is delivered",
  async () => {
    // 1. Ask the app to publish a message to its own /roundtrip/verify endpoint.
    const res = await fetch(`${deploymentURL}/roundtrip/publish`);
    if (res.status !== 200) {
      console.log(await res.text());
    }
    expect(res.status).toEqual(200);

    const { messageId } = (await res.json()) as { messageId: string };
    expect(messageId).toBeTruthy();

    // 2. Poll the message logs until the message reaches a terminal state.
    const client = new Client({ token });
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const { logs } = await client.logs({ messageIds: [messageId] });
      const states = new Set(logs.map((log) => log.state));

      if (states.has("DELIVERED")) {
        return; // success: the signed message was verified and delivered
      }
      if (states.has("FAILED") || states.has("CANCELED")) {
        throw new Error(
          `message ${messageId} did not deliver: ${JSON.stringify(logs)}`
        );
      }

      await Bun.sleep(1000);
    }

    throw new Error(`message ${messageId} was not DELIVERED within 60s`);
  },
  90_000
);
