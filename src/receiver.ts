import * as jose from "jose";
import crypto from "crypto-js";

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

  constructor(config: ReceiverConfig) {
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
  public async verify(request: VerifyRequest): Promise<boolean> {
    const isValid = await this.verifyWithKey(this.currentSigningKey, request);
    if (isValid) {
      return true;
    }
    return this.verifyWithKey(this.nextSigningKey, request);
  }

  /**
   * Verify signature with a specific signing key
   */
  private async verifyWithKey(key: string, request: VerifyRequest): Promise<boolean> {
    const jwt = await jose
      .jwtVerify(request.signature, new TextEncoder().encode(key), {
        issuer: "Upstash",
        clockTolerance: request.clockTolerance,
      })
      .catch((error: unknown) => {
        throw new SignatureError((error as Error).message);
      });

    const p = jwt.payload as {
      iss: string;
      sub: string;
      exp: number;
      nbf: number;
      iat: number;
      jti: string;
      body: string;
    };

    if (request.url !== undefined && p.sub !== request.url) {
      throw new SignatureError(`invalid subject: ${p.sub}, want: ${request.url}`);
    }

    const bodyHash = crypto.SHA256(request.body).toString(crypto.enc.Base64url);

    const padding = new RegExp(/=+$/);

    if (p.body.replace(padding, "") !== bodyHash.replace(padding, "")) {
      throw new SignatureError(`body hash does not match, want: ${p.body}, got: ${bodyHash}`);
    }

    return true;
  }
}
