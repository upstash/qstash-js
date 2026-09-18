/* eslint-disable @typescript-eslint/no-magic-numbers */
/**
 * Tests the Receiver functionality.
 */

import { describe, expect, test } from "bun:test";
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import { Receiver, SignatureError } from ".";
import { nanoid } from "./client/utils";
import { verifySignatureAppRouter } from "../platforms/nextjs";

export async function createUpstashSingature({
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
    .sign(new Uint8Array(Buffer.from(key, "utf8")));

  return jwt;
}

const currentSigningKey = nanoid();
const nextSigningKey = nanoid();

const randomBody = btoa(nanoid());
const url = "example.com";

/**
 * Asserts that `call` rejects with a SignatureError, optionally checking the
 * message. Written with try/catch because the repo's lint rules forbid
 * `await expect(...).rejects`.
 */
const expectSignatureError = async (call: () => Promise<unknown>, messageIncludes?: string) => {
  let error: unknown;
  try {
    await call();
  } catch (error_) {
    error = error_;
  }
  expect(error).toBeInstanceOf(SignatureError);
  if (messageIncludes) {
    expect((error as Error).message).toContain(messageIncludes);
  }
};

/** Wraps a counting handler with verifySignatureAppRouter using explicit keys. */
const wrapWithKeys = () => {
  let handlerCalls = 0;
  const wrapped = verifySignatureAppRouter(
    () => {
      handlerCalls += 1;
      return new Response("handled", { status: 200 });
    },
    { currentSigningKey, nextSigningKey }
  );
  return { wrapped, handlerCalls: () => handlerCalls };
};

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

  test("rejects an empty signature", async () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    await expectSignatureError(() => receiver.verify({ signature: "", body: randomBody, url }));
  });

  test("rejects a malformed signature", async () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    await expectSignatureError(() =>
      receiver.verify({ signature: "not-a-jwt", body: randomBody, url })
    );
  });

  test("rejects a signature signed with an unknown key", async () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    const forged = await createUpstashSingature({ url, body: randomBody, key: nanoid() });

    await expectSignatureError(() => receiver.verify({ signature: forged, body: randomBody, url }));
  });

  test("rejects a valid signature when the body was tampered with", async () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    const upstashSignature = await createUpstashSingature({
      url,
      body: randomBody,
      key: currentSigningKey,
    });

    await expectSignatureError(
      () => receiver.verify({ signature: upstashSignature, body: `${randomBody}tampered`, url }),
      "body hash does not match"
    );
  });

  test("rejects a valid signature when the url does not match", async () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    const upstashSignature = await createUpstashSingature({
      url,
      body: randomBody,
      key: currentSigningKey,
    });

    await expectSignatureError(
      () =>
        receiver.verify({
          signature: upstashSignature,
          body: randomBody,
          url: "other.example.com",
        }),
      "invalid subject"
    );
  });
});

describe("verifySignatureAppRouter with signing keys configured", () => {
  const requestUrl = "https://example.com/api/qstash";
  const body = JSON.stringify({ hello: "world" });

  test("returns 403 and skips the handler when the signature header is missing", async () => {
    const { wrapped, handlerCalls } = wrapWithKeys();

    const response = await wrapped(new Request(requestUrl, { method: "POST", body }));

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("header is missing");
    expect(handlerCalls()).toBe(0);
  });

  test("rejects and skips the handler when the signature header is wrong", async () => {
    const { wrapped, handlerCalls } = wrapWithKeys();
    const forged = await createUpstashSingature({ url: requestUrl, body, key: nanoid() });

    await expectSignatureError(() =>
      wrapped(
        new Request(requestUrl, {
          method: "POST",
          headers: { "upstash-signature": forged },
          body,
        })
      )
    );
    expect(handlerCalls()).toBe(0);
  });

  test("calls the handler when the signature header matches", async () => {
    const { wrapped, handlerCalls } = wrapWithKeys();
    const signature = await createUpstashSingature({
      url: requestUrl,
      body,
      key: currentSigningKey,
    });

    const response = await wrapped(
      new Request(requestUrl, {
        method: "POST",
        headers: { "upstash-signature": signature },
        body,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("handled");
    expect(handlerCalls()).toBe(1);
  });
});
