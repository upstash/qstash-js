// dnt-shim-ignore

import * as c from "../pkg/consumer.ts";
export * from "../pkg/client/client.ts";

export class Consumer extends c.Consumer {
  constructor(config: Omit<c.ConsumerConfig, "crypto">) {
    super({
      ...config,
      // dnt-shim-ignore
      subtleCrypto: crypto.subtle,
    });
  }
}
