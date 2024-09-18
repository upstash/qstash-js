import { MESSAGES, MODEL, OpenAiResponse, REDIS_PREFIX, RedisEntry } from "@/app/utils/constants"
import { serve } from "@upstash/qstash/nextjs"
import { Redis } from "@upstash/redis"
import { NextRequest } from "next/server"

const timeAccumulator: Record<string, number> = {}
const redis = Redis.fromEnv()

export const serveMethod = serve<string>(async (context) => {
  const result = await context.call<OpenAiResponse>(
    "call open ai",
    "https://api.openai.com/v1/chat/completions",
    "POST",
    {
      "model": MODEL,
      "messages": MESSAGES,
    },
    {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    }
  )

  await context.run("save results in redis", async () => {
    const key = context.requestPayload;
    console.log("OUT", key, timeAccumulator, timeAccumulator[key]);
    
    await redis.set<RedisEntry>(key, {
      time: timeAccumulator[key],
      result: result.choices[0].message.content,
    }, { ex: 120 }); // expire in 120 seconds
    delete timeAccumulator[key]
  })
})

export const POST = async (request: NextRequest) => {
  const requestClone = request.clone()
  const key = await requestClone.text()
  
  const t1 = performance.now()
  const result = await serveMethod(request)

  // console.log(timeAccumulator);

  if (key.startsWith(REDIS_PREFIX)) {
    // console.log("IN", key, timeAccumulator);
    
    const duration = performance.now() - t1
    timeAccumulator[key] = (timeAccumulator[key] ? timeAccumulator[key] : 0) + duration
  }

  return result
}