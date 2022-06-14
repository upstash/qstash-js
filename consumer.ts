import { ed25519, encoding } from "./deps.ts";

export type ConsumerConfig = {
  currentPublicKey: string;
  nextPublicKey: string;
};

export type VerifyRequest = {
  signature: string;
  url: string;
  body: string;
  headers: Headers;
};

export class Consumer {
  private readonly currentPublicKey: Uint8Array;
  private readonly nextPublicKey: Uint8Array;

  constructor(config: ConsumerConfig) {
    this.currentPublicKey = encoding.base64.decode(config.currentPublicKey);
    this.nextPublicKey = encoding.base64.decode(config.nextPublicKey);
  }

  public verify(req: VerifyRequest): Promise<boolean> {
    const signature = encoding.base64.decode(req.signature);

    const url = new TextEncoder().encode(req.url);
    const headers = new TextEncoder().encode(JSON.stringify(req.headers));
    const body = new TextEncoder().encode(req.body);

    const buf = new Uint8Array(url.length + headers.length + body.length);
    buf.set(url, 0);
    buf.set(headers, url.length);
    buf.set(body, url.length + headers.length);

    const valid = ed25519.verify(signature, buf, this.currentPublicKey);
    if (!valid) {
      console.warn("current public key is not valid");
    }
    return ed25519.verify(signature, buf, this.nextPublicKey);
  }
}
