import { serve } from "@upstash/qstash/nextjs"

import { NextRequest } from "next/server"
import { waitUntil } from "@vercel/functions"

import { PLACEHOLDER_IMAGE, RedisEntry } from "@/app/utils/constants"
import { ratelimit, redis, validateRequest } from "../utils"
import { getFetchParameters, getImageUrl, ImageResponse } from "@/app/utils/request"

const getTimeKey = (key: string) => `time-${key}`

const serveMethod = serve<{
  callKey: string,
  prompt: string
}>(async (context) => {
  const payload = context.requestPayload

  const parameters = getFetchParameters(payload.prompt)
  let result: ImageResponse
  if (parameters) {
    result = await context.call<ImageResponse>(
      "call open ai",
      parameters.url,
      parameters.method,
      parameters.body,
      parameters.headers
    )
  } else {
    await context.sleep("mock call", 2)
    result = {
      created: "",
      data: [{
        prompt: payload.prompt,
        url: PLACEHOLDER_IMAGE
      }] 
    }
  }
  

  await context.run("save results in redis", async () => {
    // save the final time key and result
    await redis.set<RedisEntry>(payload.callKey, {
      time: await redis.get(getTimeKey(payload.callKey)) ?? 0,
      url: getImageUrl(result),
    }, { ex: 120 }); // expire in 120 seconds

    await redis.del(getTimeKey(payload.callKey))
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