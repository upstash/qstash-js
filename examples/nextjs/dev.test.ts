import { test, expect } from "bun:test";

// Hits the /dev routes which use `devMode: true` — that triggers the qstash
// CLI dev server to spawn inside the Next.js process. Run after starting the
// example with `bun dev` (or via the CI nextjs-local-build job).
const deploymentURL = process.env.DEPLOYMENT_URL;
if (!deploymentURL) {
  throw new Error("DEPLOYMENT_URL not set");
}

test("/dev publishes via dev server", async () => {
  const res = await fetch(`${deploymentURL}/dev`);
  if (res.status !== 200) console.log(await res.text());
  expect(res.status).toBe(200);

  const body = (await res.json()) as { ok: boolean; messageId?: string };
  expect(body.ok).toBe(true);
  expect(body.messageId).toBeTruthy();
});

test("/dev/send → /dev/receive round trip with signature verification", async () => {
  const sendRes = await fetch(`${deploymentURL}/dev/send`);
  expect(sendRes.status).toBe(200);
  const { messageId } = (await sendRes.json()) as { messageId: string };
  expect(messageId).toBeTruthy();

  // Dev server delivers asynchronously; poll the receive route for arrival.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const checkRes = await fetch(`${deploymentURL}/dev/receive?check=${messageId}`);
    const { received } = (await checkRes.json()) as { received: boolean };
    if (received) return;
    await Bun.sleep(250);
  }
  throw new Error(`message ${messageId} never delivered to /dev/receive within 10s`);
});

test("/dev/receive rejects unsigned requests", async () => {
  const res = await fetch(`${deploymentURL}/dev/receive`, {
    method: "POST",
    body: JSON.stringify({ hello: "no signature" }),
  });
  // verifySignatureAppRouter returns 403 when the signature header is missing.
  expect(res.status).toBe(403);
});
