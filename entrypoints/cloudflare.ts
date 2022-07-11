// dnt-shim-ignore

import * as r from "../pkg/receiver.ts";
export * from "../pkg/client/client.ts";

export class Receiver extends r.Receiver {
  constructor(config: Omit<r.ReceiverConfig, "subtleCrypto">) {
    super({
      ...config,
      // dnt-shim-ignore
      subtleCrypto: crypto.subtle,
    });
  }
}
