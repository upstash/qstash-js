import { Client, Receiver } from "@upstash/qstash";
import { serve } from "@upstash/qstash/workflow";

export type Env = {
  QSTASH_URL: string;
  QSTASH_TOKEN: string;
  QSTASH_CURRENT_SIGNING_KEY: string;
  QSTASH_NEXT_SIGNING_KEY: string;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method !== "POST")
      return new Response("Only POST requests are allowed", { status: 405 });

    const client = new Client({
      baseUrl: env.QSTASH_URL,
      token: env.QSTASH_TOKEN,
    });

    const url = new URL(request.url);

    if (url.pathname === "/test") {
      await client.publish({
        url: url.origin + "/workflow",
      });
      return new Response("Published to workflow");
    } else if (url.pathname === "/workflow") {
      const receiver = new Receiver({
        currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
      });

      const handler = serve(
        async (context) => {
          const output1 = await context.run("step 1", async () => {
            console.log("-- step 1 done");
            return "out-1";
          });

          const output2 = await context.run("step 2", async () => {
            console.log("-- step 2 done");
            return "out-2";
          });

          await context.run("step 3", async () => {
            console.log("-- finished, output1:", output1, "output2:", output2);
          });
        },
        {
          qstashClient: client,
          receiver: receiver,
        }
      );

      return handler(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
