import * as base64url from "https://deno.land/std@0.144.0/encoding/base64url.ts";
import * as base64 from "https://deno.land/std@0.144.0/encoding/base64.ts";

export type ConsumerConfig = {
  currentSigningKey: string;
  nextSigningKey: string;
};

export type VerifyRequest = {
  signature: string;
  body: string;
  url: string;
};

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureError";
  }
}
export class Consumer {
  private readonly currentSigningKey: string;
  private readonly nextSigningKey: string;

  constructor(config: ConsumerConfig) {
    this.currentSigningKey = config.currentSigningKey;
    this.nextSigningKey = config.nextSigningKey;
  }

  public async verify(req: VerifyRequest): Promise<boolean> {
    const isValid = await this.verifyWithKey(this.currentSigningKey, req);
    if (isValid) {
      return true;
    }
    return this.verifyWithKey(this.nextSigningKey, req);
  }

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
      throw new SignatureError(`invalid subject: ${p.sub}`);
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
    if (p.body != base64.encode(bodyHash)) {
      throw new SignatureError("body hash does not match");
    }

    return true;
  }
}
