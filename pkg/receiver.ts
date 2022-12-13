import { base64Url } from "../deps.ts";
import { crypto } from "https://deno.land/std/crypto/mod.ts";
export type SubtleCrypto = typeof crypto.subtle;

/**
 * Necessary to verify the signature of a request.
 */
export type ReceiverConfig = {
  /**
   * The current signing key. Get it from `https://console.upstash.com/qstash
   */
  currentSigningKey: string;
  /**
   * The next signing key. Get it from `https://console.upstash.com/qstash
   */
  nextSigningKey: string;

  subtleCrypto: SubtleCrypto;
};

export type VerifyRequest = {
  /**
   * The signature from the `upstash-signature` header.
   */
  signature: string;

  /**
   * The raw request body.
   */
  body: string | Uint8Array;

  /**
   * URL of the endpoint where the request was sent to.
   *
   * Omit empty to disable checking the url.
   */
  url?: string;

  /**
   * Number of seconds to tolerate when checking `nbf` and `exp` claims, to deal with small clock differences among different servers
   *
   * @default 0
   */
  clockTolerance?: number;
};

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureError";
  }
}
/**
 * Receiver offers a simlpe way to verify the signature of a request.
 */
export class Receiver {
  private readonly currentSigningKey: string;
  private readonly nextSigningKey: string;
  private readonly subtleCrypto: SubtleCrypto;

  constructor(config: ReceiverConfig) {
    this.currentSigningKey = config.currentSigningKey;
    this.nextSigningKey = config.nextSigningKey;
    this.subtleCrypto = config.subtleCrypto;
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

    const k = await this.subtleCrypto.importKey(
      "raw",
      new TextEncoder().encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const isValid = await this.subtleCrypto.verify(
      { name: "HMAC" },
      k,
      base64Url.decode(signature),
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
    } = JSON.parse(new TextDecoder().decode(base64Url.decode(payload)));
    if (p.iss !== "Upstash") {
      throw new SignatureError(`invalid issuer: ${p.iss}`);
    }

    if (typeof req.url !== "undefined" && p.sub !== req.url) {
      throw new SignatureError(`invalid subject: ${p.sub}, want: ${req.url}`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - (req.clockTolerance ?? 0) > p.exp) {
      console.log({ now, exp: p.exp });
      throw new SignatureError("token has expired");
    }
    if (now + (req.clockTolerance ?? 0) < p.nbf) {
      throw new SignatureError("token is not yet valid");
    }

    const bodyHash = await this.subtleCrypto.digest(
      "SHA-256",
      typeof req.body === "string"
        ? new TextEncoder().encode(req.body)
        : req.body,
    );

    const padding = new RegExp(/=+$/);

    if (
      p.body.replace(padding, "") !==
        base64Url.encode(bodyHash).replace(padding, "")
    ) {
      throw new SignatureError(
        `body hash does not match, want: ${p.body}, got: ${
          base64Url.encode(bodyHash)
        }`,
      );
    }

    return true;
  }
}
