// Minimal reproduction attempt for:
//   (node:xxx) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized ...
// reported against @upstash/qstash 2.11.0 (crypto-js 4.2.0) on Node.js 24.
//
// Run with Node 24:   npm install && npm start
// The script exercises the exact code path that used crypto-js
// (Receiver.verify -> SHA256(body).toString(Base64url)) plus the client, and
// prints every process warning explicitly, so a DEP0169 can't slip by.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Client, Receiver } from "@upstash/qstash";
import { SignJWT } from "jose";

const version = (pkg) =>
  JSON.parse(readFileSync(new URL(`./node_modules/${pkg}/package.json`, import.meta.url), "utf8")).version;
const warnings = [];
process.on("warning", (w) => {
  warnings.push(w);
  console.log(`\n!!! process warning: [${w.code ?? w.name}] ${w.message}\n${w.stack}\n`);
});

console.log("node:           ", process.version);
console.log("@upstash/qstash:", version("@upstash/qstash"));
console.log("crypto-js:      ", version("crypto-js"));
console.log("jose:           ", version("jose"));
console.log();

// --- 1. Receiver.verify with a signature built the same way QStash builds it.
const KEY = "test-signing-key";
const receiver = new Receiver({ currentSigningKey: KEY, nextSigningKey: KEY, devMode: false });
const url = "https://example.com/api/endpoint";
const body = JSON.stringify({ hello: "world" });
const now = Math.floor(Date.now() / 1000);
const signature = await new SignJWT({
  iss: "Upstash", sub: url, exp: now + 300, nbf: now, iat: now, jti: `jti-${now}`,
  body: createHash("sha256").update(body).digest("base64url"),
})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .sign(new TextEncoder().encode(KEY));

for (let i = 1; i <= 3; i++) {
  const ok = await receiver.verify({ signature, body, url });
  console.log(`Receiver.verify #${i}:`, ok);
}

// --- 2. Client request path (uses fetch). Uses the real API if QSTASH_TOKEN is
// set, otherwise hits an unreachable base URL just to run the request code.
const client = new Client({
  token: process.env.QSTASH_TOKEN ?? "dummy-token",
  baseUrl: process.env.QSTASH_TOKEN ? undefined : "http://127.0.0.1:9",
});
try {
  const res = await client.publishJSON({ url: "https://example.com/api/endpoint", body: { hello: "world" } });
  console.log("client.publishJSON:", res);
} catch (error) {
  console.log("client.publishJSON errored (expected without a token):", error.constructor.name);
}

// --- 3. Optional control: show what DEP0169 looks like when app code (not
// node_modules) calls url.parse(). Only with --demo-warning.
if (process.argv.includes("--demo-warning")) {
  const { parse } = await import("node:url");
  parse("https://example.com/control");
  await new Promise((r) => setImmediate(r)); // let the warning event flush
}

console.log(`\nDone. Warnings emitted: ${warnings.length}`);
