import * as jose from "jose";
import { getSafeEnvironment } from "./client/utils";
import { getReceiverSigningKeys } from "./client/multi-region";

/**
 * Computes the SHA-256 hash of the given string and returns it as a
 * base64url-encoded value (without padding).
 *
 * Uses the Web Crypto API (`globalThis.crypto`), available in Node.js 16+,
 * browsers, and edge runtimes. This replaces `crypto-js`, which relied on the
 * deprecated `url.parse()` and triggered Node.js DEP0169 warnings.
 */
async function sha256Base64url(body: string): Promise<string> {
  const webCrypto = globalThis.crypto;
  // The types claim `crypto.subtle` is always present, but it can be missing at
  // runtime (older/edge runtimes), so keep the guard despite the lint rule.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!webCrypto?.subtle) {
    throw new Error("[Upstash QStash] Web Crypto API is not available in this runtime.");
  }
  const hashBuffer = await webCrypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return jose.base64url.encode(new Uint8Array(hashBuffer));
}

/**
 * Necessary to verify the signature of a request.
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
   * @default undefined
   */
  devMode?: boolean;
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
    await this.verifyBodyAndUrl(payload, request);
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

  private async verifyBodyAndUrl(payload: jose.JWTPayload, request: VerifyRequest) {
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

    const bodyHash = await sha256Base64url(request.body);

    const padding = new RegExp(/=+$/);

    if (p.body.replace(padding, "") !== bodyHash.replace(padding, "")) {
      throw new SignatureError(`body hash does not match, want: ${p.body}, got: ${bodyHash}`);
    }
  }
}
