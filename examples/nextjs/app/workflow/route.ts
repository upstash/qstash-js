import { Client } from "@upstash/qstash";

const client = new Client({
  baseUrl: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!
});

export async function POST(request: Request) {
  
  // hide the workflow url
  const context = await client.workflow(request)

  // {value : 4}
  const result1 = await context.run("step uno", () => {
    console.log("A");
    return Promise.resolve({value : 2 + 2});
  });

  const now = new Date()
  now.setSeconds(now.getSeconds() + 5);
  await context.sleepUntil("sleeping", now)


  // 10
  const result2 = await context.run("step dos", async () => {
    console.log("B");
    return result1.value + 6
  });

  await context.sleep("sleeping", 5)
  
  // 14
  const result3 = await context.run("step tres", async () => {
    console.log("C");
    return await Promise.resolve(result1.value + result2);
  });

  return new Response(context.workflowId, {status: 200})

}
