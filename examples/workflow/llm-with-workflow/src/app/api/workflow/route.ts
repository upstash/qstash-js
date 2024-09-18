import { serve } from "@upstash/qstash/nextjs"

import { NextRequest, NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"

import { MESSAGES, MODEL, OpenAiResponse, REDIS_PREFIX, RedisEntry } from "@/app/utils/constants"
import { ratelimit, redis } from "../utils"

const getTimeKey = (key: string) => `time-${key}`

export const serveMethod = serve<string>(async (context) => {
  const result = await context.call<OpenAiResponse>(
    "call open ai",
    "https://api.openai.com/v1/chat/completions",
    "POST",
    {
      "model": MODEL,
      "messages": MESSAGES,
      "temperature": 0
    },
    {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    }
  )

  await context.run("save results in redis", async () => {
    const key = context.requestPayload;
    await redis.set<RedisEntry>(key, {
      time: await redis.get(getTimeKey(key)) ?? 0,
      result: result.choices[0].message.content,
    }, { ex: 120 }); // expire in 120 seconds
    await redis.del(getTimeKey(key))
  })
})

export const POST = async (request: NextRequest) => {
  const ip = request.ip ?? "ip-missing"
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return new NextResponse("You have reached the rate limit. Please try again later.", {status: 429})
  }

  const requestClone = request.clone()
  const key = await requestClone.text()
  
  const t1 = performance.now()
  const result = await serveMethod(request)

  if (key.startsWith(REDIS_PREFIX)) {
    
    const duration = performance.now() - t1

    const pipe = redis.pipeline()
    const timeKey = getTimeKey(key)
    pipe.incrbyfloat(timeKey, duration)
    pipe.expire(timeKey, 120) // expire in 120 seconds
    waitUntil(pipe.exec())
  }

  return result
}