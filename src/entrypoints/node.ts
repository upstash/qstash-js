
import { Receiver as Core, ReceiverConfig } from "../receiver";
export * from "../client/client";
import {subtle} from "node:crypto"

export class Receiver extends Core {

    constructor(config: Omit<ReceiverConfig, "subtleCrypto">){
        super({...config, subtleCrypto: subtle})
    }
}
