// Runtime check for the receiver's SHA-256 hashing across Node.js versions.
//
// `bun test` can't cover this: it runs on Bun, which always has
// globalThis.crypto. Running this under plain `node` across the version matrix
// (see the node-versions CI job) exercises the real runtime behavior — most
// importantly Node < 19, where Web Crypto isn't a global and the receiver must
// fall back to node:crypto.
//
// It builds a valid Upstash signature with jose + node:crypto and asserts that
// Receiver.verify() accepts it. Run after `bun run build` (imports ../dist).
import assert from "node:assert";
import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { Receiver } from "../dist/index.mjs";

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

const receiver = new Receiver({ currentSigningKey: KEY, nextSigningKey: KEY });

async function verifyRoundTrip(label) {
  const signature = await makeSignature(BODY);
  const ok = await receiver.verify({ signature, body: BODY });
  assert.strictEqual(ok, true, `${label}: verify() should return true`);
  console.log(
    `✓ ${label} (node ${process.version}, globalThis.crypto: ${typeof globalThis.crypto})`
  );
}

// Verify using whatever this Node version offers: the global Web Crypto on
// Node >= 19, or the node:crypto fallback on Node < 19.
await verifyRoundTrip("native path");

console.log("All Web Crypto runtime checks passed.");
