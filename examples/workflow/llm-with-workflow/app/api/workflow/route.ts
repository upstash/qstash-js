import { serve } from '@upstash/qstash/nextjs'

import { NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'

import { ratelimit, redis, validateRequest } from 'utils/redis'
import { getFetchParameters } from 'utils/request'
import { ImageResponse, RedisEntry } from 'utils/types'
import { PLACEHOLDER_IMAGE, PROMPTS, RATELIMIT_CODE } from 'utils/constants'

const getTimeKey = (key: string) => `time-${key}`

export const POST = async (request: NextRequest) => {
  const response = await validateRequest(request, ratelimit)
  if (response.status === RATELIMIT_CODE) return response

  const t1 = performance.now()
  const result = await serveMethod(request)

  const key = request.headers.get('callKey')

  if (key) {
    const duration = performance.now() - t1

    const pipe = redis.pipeline()
    const timeKey = getTimeKey(key)
    pipe.incrbyfloat(timeKey, duration)
    pipe.expire(timeKey, 120) // expire in 120 seconds
    waitUntil(pipe.exec())
  } else {
    console.warn(
      "callKey header was missing. couldn't log the time for the call.",
    )
  }

  return result
}

const serveMethod = serve<{
  callKey: string
  prompt: number
}>(async (context) => {
  const payload = context.requestPayload
  const prompt = PROMPTS[payload.prompt]

  const parameters = getFetchParameters(prompt)
  let result: ImageResponse

  if (parameters) {
    result = await context.call<ImageResponse>(
      'call open ai',
      parameters.url,
      parameters.method,
      parameters.body,
      parameters.headers,
    )
  } else {
    await context.sleep('mock call', 2)
    result = {
      created: '',
      data: [
        {
          prompt,
          url: PLACEHOLDER_IMAGE,
        },
      ],
    }
  }

  await context.run('save results in redis', async () => {
    // save the final time key and result
    await redis.set<RedisEntry>(
      payload.callKey,
      {
        time: (await redis.get(getTimeKey(payload.callKey))) ?? 0,
        url: result.data[0].url,
      },
      { ex: 120 },
    ) // expire in 120 seconds

    await redis.del(getTimeKey(payload.callKey))
  })
})
