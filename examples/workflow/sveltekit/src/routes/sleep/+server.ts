import { serve } from "@upstash/qstash/svelte";
import { env } from '$env/dynamic/private'
import { Client, Receiver } from "@upstash/qstash";

const someWork = (input: string) => {
  return `processed '${JSON.stringify(input)}'`
}

export const POST = serve<string>({
  routeFunction: async context => {
    const input = context.requestPayload
    const result1 = await context.run("step1", async () => {
      const output = someWork(input)
      console.log("step 1 input", input, "output", output)
      return output
    });

    await context.sleepUntil("sleep1", (Date.now()/1000) + 3)

    const result2 = await context.run("step2", async () => {
      const output = someWork(result1)
      console.log("step 2 input", result1, "output", output)
      return output
    });

    await context.sleep("sleep2", 2)

    const result3 = await context.run("step3", async () => {
      const output = someWork(result2)
      console.log("step 3 input", result2, "output", output)
    });
  },
  client: new Client({
    baseUrl: env.QSTASH_URL!,
    token: env.QSTASH_TOKEN!,
  }),
  receiver: new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  })
})


