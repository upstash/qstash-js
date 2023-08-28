
import {Receiver as Core,ReceiverConfig} from "../receiver";
export * from "../client/client";

export class Receiver extends Core {
  constructor(config: Omit<ReceiverConfig, "subtleCrypto">) {
    super({
      ...config,
      // dnt-shim-ignore
      subtleCrypto: crypto.subtle,
    });
  }
}