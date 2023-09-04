import { Receiver } from "@upstash/qstash";

export type Env = {
  QSTASH_CURRENT_SIGNING_KEY: string;
  QSTASH_NEXT_SIGNING_KEY: string;
};

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const c = new Receiver({
      currentSigningKey:
        env.QSTASH_CURRENT_SIGNING_KEY ,
      nextSigningKey:
        env.QSTASH_NEXT_SIGNING_KEY,
    });

    const body = await request.text();

    const isValid = await c.verify({
      signature: request.headers.get("Upstash-Signature")!,
      body,
    });
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }
    console.log("was valid");
    return new Response("Hello World!");
  },
};
