import * as jose from "jose";
import crypto from "crypto-js";
import { getSafeEnvironment } from "./client/utils";
import { getReceiverSigningKeys } from "./client/multi-region";

/**
 * Necessary to verify the signature of a request.
 *
 * @see node_modules/@upstash/qstash/docs/examples/receiver.mdx
 */
export type ReceiverConfig = {
  /**
   * The current signing key. Get it from `https://console.upstash.com/qstash
   *
   * If not provided, value will be inferred from environment variables based on QSTASH_REGION
   * and UPSTASH_REGION header.
   */
  currentSigningKey?: string;
  /**
   * The next signing key. Get it from `https://console.upstash.com/qstash
   *
   * If not provided, value will be inferred from environment variables based on QSTASH_REGION
   * and UPSTASH_REGION header.
   */
  nextSigningKey?: string;
  /**
   * Controls the local dev server signing keys.
   * - `true`: use dev server signing keys
   * - `false`: never use dev server signing keys (ignores QSTASH_DEV env var)
   * - `undefined`: check QSTASH_DEV env var
   *
   * When devMode is true, or devMode is undefined and QSTASH_DEV is "true" or "1", the configured
   * keys are ignored and the local dev server's public keys are accepted. Never set QSTASH_DEV in
   * production; pass devMode: false there to be safe.
   *
   * @default undefined
   */
  devMode?: boolean;
};

/**
 * @see node_modules/@upstash/qstash/docs/examples/receiver.mdx
 */
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
   * url must equal the URL the message was published to, query string included (QStash drops
   * upstash-* query parameters). Do not pass request.url: behind a proxy, or when the server
   * binds 0.0.0.0, it differs from the published URL and verify throws "invalid subject". Build
   * it from your configured public origin plus the path. Leaving url undefined skips the check,
   * so a signature for any other endpoint of your account is accepted; url: "" throws. A
   * signature stays valid for 5 minutes and can be replayed in that window, so deduplicate by
   * the Upstash-Message-Id header.
   */
  url?: string;

  /**
   * Number of seconds to tolerate when checking `nbf` and `exp` claims, to deal with small clock differences among different servers
   *
   * @default 0
   */
  clockTolerance?: number;

  /**
   * The region from the `upstash-region` header.
   *
   * Used to infer which signing keys to use for verification in multi-region setups.
   */
  upstashRegion?: string;
};

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureError";
  }
}
/**
 * Receiver offers a simple way to verify the signature of a request.
 *
 * When devMode is true, or devMode is undefined and QSTASH_DEV is "true" or "1", the configured
 * keys are ignored and the local dev server's public keys are accepted. Never set QSTASH_DEV in
 * production; pass devMode: false there to be safe.
 *
 * @see node_modules/@upstash/qstash/docs/examples/receiver.mdx
 */
export class Receiver {
  private readonly currentSigningKey?: string;
  private readonly nextSigningKey?: string;
  private readonly devMode?: boolean;

  constructor(config?: ReceiverConfig) {
    this.currentSigningKey = config?.currentSigningKey;
    this.nextSigningKey = config?.nextSigningKey;
    this.devMode = config?.devMode;
  }

  /**
   * Verify the signature of a request.
   *
   * Tries to verify the signature with the current signing key.
   * If that fails, maybe because you have rotated the keys recently, it will
   * try to verify the signature with the next signing key.
   *
   * If that fails, the signature is invalid and a `SignatureError` is thrown.
   *
   * Resolves to true or throws; it never returns false. Without signing keys it throws a plain
   * `Error`, not a `SignatureError`.
   *
   * url must equal the URL the message was published to, query string included (QStash drops
   * upstash-* query parameters). Do not pass request.url: behind a proxy, or when the server
   * binds 0.0.0.0, it differs from the published URL and verify throws "invalid subject". Build
   * it from your configured public origin plus the path. Leaving url undefined skips the check,
   * so a signature for any other endpoint of your account is accepted; url: "" throws. A
   * signature stays valid for 5 minutes and can be replayed in that window, so deduplicate by
   * the Upstash-Message-Id header.
   *
   * @see node_modules/@upstash/qstash/docs/examples/receiver.mdx
   */
  public async verify(request: VerifyRequest): Promise<boolean> {
    const environment = getSafeEnvironment();
    // Resolve signing keys using multi-region logic
    const signingKeys = getReceiverSigningKeys({
      environment,
      regionFromHeader: request.upstashRegion,
      config: {
        currentSigningKey: this.currentSigningKey,
        nextSigningKey: this.nextSigningKey,
      },
      devMode: this.devMode,
    });

    if (!signingKeys) {
      throw new Error(
        "[Upstash QStash] No signing keys available for verification. See the warning above for more details."
      );
    }

    let payload: jose.JWTPayload;
    try {
      payload = await this.verifyWithKey(signingKeys.currentSigningKey, request);
    } catch {
      payload = await this.verifyWithKey(signingKeys.nextSigningKey, request);
    }
    this.verifyBodyAndUrl(payload, request);
    return true;
  }

  /**
   * Verify signature with a specific signing key
   */
  private async verifyWithKey(key: string, request: VerifyRequest): Promise<jose.JWTPayload> {
    const jwt = await jose
      .jwtVerify(request.signature, new TextEncoder().encode(key), {
        issuer: "Upstash",
        clockTolerance: request.clockTolerance,
      })
      .catch((error: unknown) => {
        throw new SignatureError((error as Error).message);
      });

    return jwt.payload;
  }

  private verifyBodyAndUrl(payload: jose.JWTPayload, request: VerifyRequest) {
    const p = payload as {
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
  }
}
