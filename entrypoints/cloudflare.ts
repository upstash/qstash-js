// dnt-shim-ignore

import * as r from "../pkg/receiver";
export * from "../pkg/client/client";

export class Receiver extends r.Receiver {
  constructor(config: Omit<r.ReceiverConfig, "subtleCrypto">) {
    super({
      ...config,
      // dnt-shim-ignore
      subtleCrypto: crypto.subtle,
    });
  }
}
