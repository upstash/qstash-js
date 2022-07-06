import * as base64url from "https://deno.land/std@0.144.0/encoding/base64url.ts";

export type ConsumerConfig = {
  currentSigningKey: string;
  nextSigningKey: string;
};

export type VerifyRequest = {
  /**
   * The signature from the `upstash-signature` header.
   */
  signature: string;

  /**
   * The raw request body.
   */
  body: string;

  /**
   * URL of the endpoint where the request was sent to.
   */
  url: string;
};

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureError";
  }
}
/**
 * Consumer offers a simlpe way to verify the signature of a request.
 */
export class Consumer {
  private readonly currentSigningKey: string;
  private readonly nextSigningKey: string;

  constructor(config: ConsumerConfig) {
    this.currentSigningKey = config.currentSigningKey;
    this.nextSigningKey = config.nextSigningKey;
  }

  /**
   * Verify the signature of a request.
   *
   * Tries to verify the signature with the current signing key.
   * If that fails, maybe because you have rotated the keys recently, it will
   * try to verify the signature with the next signing key.
   *
   * If that fails, the signature is invalid and a `SignatureError` is thrown.
   */
  public async verify(req: VerifyRequest): Promise<boolean> {
    const isValid = await this.verifyWithKey(this.currentSigningKey, req);
    if (isValid) {
      return true;
    }
    return this.verifyWithKey(this.nextSigningKey, req);
  }

  /**
   * Verify signature with a specific signing key
   */
  private async verifyWithKey(
    key: string,
    req: VerifyRequest,
  ): Promise<boolean> {
    const parts = req.signature.split(".");

    if (parts.length !== 3) {
      throw new SignatureError(
        "`Upstash-Signature` header is not a valid signature",
      );
    }
    const [header, payload, signature] = parts;

    const k = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const isValid = await crypto.subtle.verify(
      { name: "HMAC" },
      k,
      base64url.decode(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    );

    if (!isValid) {
      throw new SignatureError("signature does not match");
    }

    const p: {
      iss: string;
      sub: string;
      exp: number;
      nbf: number;
      iat: number;
      jti: string;
      body: string;
    } = JSON.parse(new TextDecoder().decode(base64url.decode(payload)));
    console.log(JSON.stringify(p, null, 2));
    if (p.iss !== "Upstash") {
      throw new SignatureError(`invalid issuer: ${p.iss}`);
    }
    if (p.sub !== req.url) {
      throw new SignatureError(`invalid subject: ${p.sub}, want: ${req.url}`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (now > p.exp) {
      console.log({ now, exp: p.exp });
      throw new SignatureError("token has expired");
    }
    if (now < p.nbf) {
      throw new SignatureError("token is not yet valid");
    }

    const bodyHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(req.body),
    );

    if (
      p.body.replaceAll("=", "") != base64url.encode(bodyHash).replace("=", "")
    ) {
      throw new SignatureError(
        `body hash does not match, want: ${p.body}, got: ${
          base64url.encode(bodyHash)
        }`,
      );
    }

    return true;
  }
}
