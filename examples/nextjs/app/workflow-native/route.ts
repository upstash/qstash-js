
import { Client } from "@upstash/qstash";

const client = new Client({
  baseUrl: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!
});

export const POST = client.serve(
  async context => {
    const id = Math.random()
    console.log(id, "XX")
    const result1 = await context.run("step uno", () => {
      console.log("A");
      return Promise.resolve({value : 2 + 2});
    });
  
    // 10
    const result2 = await context.run("step dos", async () => {
      console.log("B");
      return result1.value + 6
    });

    const parallelResult = await Promise.all([
      await context.run("parallel step 1", async () => {
        console.log("C1")
        return result2 * 2
      }),
      await context.run("parallel step 1", async () => {
        console.log("C2")
        return result2 * 3
      })
    ])
    
    // 14
    const result3 = await context.run("step tres", async () => {
      console.log("C");
      return await Promise.resolve(result1.value + result2);
    });
  },
  (workflowId) => {
    return new Response(JSON.stringify({workflowId: workflowId}), {status: 200})
  }
)

