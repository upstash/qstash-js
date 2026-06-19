// Runtime check for the receiver's SHA-256 hashing across Node.js versions.
//
// `bun test` can't cover this: Bun always has globalThis.crypto, so the
// node:crypto fallback in sha256Base64url never runs there. This script runs
// under plain `node` (see the node-versions CI job) and exercises BOTH paths:
//   1. the global Web Crypto path (Node >= 19)
//   2. the node:crypto fallback (Node < 19, and forced here on newer Node)
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
  console.log(`✓ ${label} (node ${process.version}, globalThis.crypto: ${typeof globalThis.crypto})`);
}

// 1. Whatever this Node version offers natively (global on >=19, fallback on <19).
await verifyRoundTrip("native path");

// 2. Force the node:crypto fallback even on a runtime that has the global, so
//    the fallback branch is covered regardless of version. Best-effort: some
//    runtimes make globalThis.crypto non-configurable, in which case we skip
//    (the Node 18 matrix entry still exercises the fallback for real).
const savedCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
let unset = false;
try {
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
  unset = globalThis.crypto === undefined;
} catch {
  unset = false;
}

if (unset) {
  try {
    await verifyRoundTrip("forced node:crypto fallback");
  } finally {
    if (savedCrypto) Object.defineProperty(globalThis, "crypto", savedCrypto);
  }
} else {
  console.log("• skipped forced fallback (globalThis.crypto is not configurable here)");
}

console.log("All Web Crypto runtime checks passed.");
