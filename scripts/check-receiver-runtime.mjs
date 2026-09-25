// Runtime check for the receiver's SHA-256 hashing across runtimes.
//
// `bun test` can't cover this: it only runs on Bun. Running this under plain
// `node` across the version matrix (see the receiver-node-versions CI job)
// exercises the real runtime behavior, most importantly Node.js 16/18, which
// have no global Web Crypto and rely on uncrypto's `node` export condition.
//
// It builds a valid Upstash signature with jose + node:crypto and asserts that
// Receiver.verify() accepts it, through both the ESM and the CJS build. Run
// after `bun run build` (imports ../dist).
import assert from "node:assert";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { SignJWT } from "jose";
import { Receiver as EsmReceiver } from "../dist/index.mjs";

const { Receiver: CjsReceiver } = createRequire(import.meta.url)("../dist/index.js");

const KEY = "test-signing-key";
const BODY = JSON.stringify({ hello: "web crypto runtime check" });

async function makeSignature(body) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "Upstash",
    sub: "",
    exp: now + 300,
    nbf: now,
    iat: now,
    jti: `jwt-${now}`,
    body: createHash("sha256").update(body).digest("base64url"),
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(new TextEncoder().encode(KEY));
}

const runtime = typeof Bun === "undefined" ? `node ${process.version}` : `bun ${Bun.version}`;

for (const [label, Receiver] of [
  ["ESM", EsmReceiver],
  ["CJS", CjsReceiver],
]) {
  const receiver = new Receiver({ currentSigningKey: KEY, nextSigningKey: KEY });
  const signature = await makeSignature(BODY);

  assert.strictEqual(
    await receiver.verify({ signature, body: BODY }),
    true,
    `${label}: verify() should accept a valid signature`
  );
  await assert.rejects(
    receiver.verify({ signature, body: `${BODY} ` }),
    `${label}: verify() should reject a tampered body`
  );

  console.log(`✓ ${label} (${runtime}, globalThis.crypto: ${typeof globalThis.crypto})`);
}

console.log("All receiver runtime checks passed.");
