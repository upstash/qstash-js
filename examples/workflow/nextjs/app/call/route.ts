
import { serve } from "@upstash/qstash/nextjs";

const someWork = (input: string) => {
  return `processed '${JSON.stringify(input)}'`
}

export const POST = serve<string>(
  async context => {
    const input = context.requestPayload

    const result1 = await context.run("step1", async () => {
      const output = someWork(input)
      console.log("step 1 input", input, "output", output)
      return output
    });

    const getResult = await context.call<string>("get call", `${context.url}-endpoint`, "GET")

    const result2 = await context.run("step2", async () => {
      console.log("get result:", getResult);
      return someWork(getResult)
    })

    const postResult = await context.call<string>("post call", `${context.url}-endpoint`, "POST", "my-payload")

    const result3 = await context.run("step3", async () => {
      console.log("post result:", postResult)
    });
  }
)
