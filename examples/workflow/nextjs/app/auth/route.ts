
import { serve } from "@upstash/qstash/nextjs";

export const POST = serve<string>({
  routeFunction: async context => {
    
    if (context.headers.get("authentication") !== "Bearer secretPassword" ) {
      console.error("Authentication failed.");
      return
    }
    const input = context.requestPayload

    const result1 = await context.run("step1", async () => {
      return "output 1"
    });

    const result2 = await context.run("step2", async () => {
      return "output 2"
    })
  }
})
  