import { serve } from "@upstash/qstash/cloudflare";

const someWork = (input: string) => {
  return `processed '${JSON.stringify(input)}'`
}

export default {
  fetch: serve<{text: string}>(async context => {
		if (!context.requestPayload) throw new Error('No payload given, send a curl request to start the workflow');

    const input = context.requestPayload.text
    const result1 = await context.run("step1", async () => {
      const output = someWork(input)
      console.log("step 1 input", input, "output", output)
      return output
    });

    const result2 = await context.run("step2", async () => {
      const output = someWork(result1)
      console.log("step 2 input", result1, "output", output)
    });
  },
  {
    receiver: undefined,
  })
};
