// dnt-shim-ignore

import * as c from "./pkg/receiver.ts";
export * from "./pkg/client/client.ts";

export class Receiver extends c.Receiver {
  constructor(config: Omit<c.ReceiverConfig, "crypto">) {
    super({
      ...config,
      // dnt-shim-ignore
      subtleCrypto: crypto.subtle,
    });
  }
}
