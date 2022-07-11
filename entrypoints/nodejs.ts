// dnt-shim-ignore

import * as r from "../pkg/receiver.ts";
export * from "../pkg/client/client.ts";

export class Receiver extends r.Receiver {
  constructor(config: Omit<r.ReceiverConfig, "crypto">) {
    super({
      ...config,
      // use the shimmed one from deno
      subtleCrypto: crypto.subtle,
    });
  }
}
