/* eslint-disable @typescript-eslint/no-magic-numbers */
/**
 * Tests the Receiver functionality.
 */

import { describe, test } from "bun:test";
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import { Receiver } from ".";
import { nanoid } from "./client/utils";

async function createUpstashSingature({
  url,
  body,
  key,
}: {
  url: string;
  body: string;
  key: string;
}) {
  const payload = {
    iss: "Upstash",
    sub: url,
    exp: Math.floor(Date.now() / 1000) + 300, // expires in 5 minutes
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: `jwt_${Math.random().toString(36).slice(2, 15)}`,
    body: createHash("sha256").update(body).digest("base64url"),
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(Buffer.from(key, "utf8"));

  return jwt;
}

const currentSigningKey = nanoid();
const nextSigningKey = nanoid();

const randomBody = btoa(nanoid());
const url = "example.com";

describe("receiver", () => {
  test("verify signed with currentSigningKey", async () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    const upstashSignature = await createUpstashSingature({
      url: url,
      body: randomBody,
      key: currentSigningKey,
    });

    await receiver.verify({
      signature: upstashSignature,
      body: randomBody,
      url: url,
    });
  });

  test("verify signed with nextSigninKey", async () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    const upstashSignature = await createUpstashSingature({
      url: url,
      body: randomBody,
      key: nextSigningKey,
    });

    await receiver.verify({
      signature: upstashSignature,
      body: randomBody,
      url: url,
    });
  });
});
