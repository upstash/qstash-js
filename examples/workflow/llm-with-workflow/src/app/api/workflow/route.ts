import { serve } from "@upstash/qstash/nextjs"

import { NextRequest } from "next/server"
import { waitUntil } from "@vercel/functions"

import { MESSAGES, MODEL, OpenAiResponse, RedisEntry } from "@/app/utils/constants"
import { ratelimit, redis, validateRequest } from "../utils"

const getTimeKey = (key: string) => `time-${key}`

const serveMethod = serve<string>(async (context) => {
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
  const response = await validateRequest(request, ratelimit)
  if (response) return response;
  
  const t1 = performance.now()
  const result = await serveMethod(request)

  const key = request.headers.get("callKey")
  
  if (key) {
    const duration = performance.now() - t1    

    const pipe = redis.pipeline()
    const timeKey = getTimeKey(key)
    pipe.incrbyfloat(timeKey, duration)
    pipe.expire(timeKey, 120) // expire in 120 seconds
    waitUntil(pipe.exec())
  } else {
    console.warn("callKey header was missing. couldn't log the time for the call.")
  }

  return result
}