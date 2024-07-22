
import { serve } from "@upstash/qstash/workflow/nuxt";

const someWork = (input: string) => {
  return `processed '${JSON.stringify(input)}'`
}

export default serve<string>({
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
  }
})


