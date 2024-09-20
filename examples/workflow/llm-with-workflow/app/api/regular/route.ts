import { NextRequest, NextResponse } from 'next/server'
import { ratelimit, validateRequest } from 'utils/redis'
import { getFetchParameters } from 'utils/request'
import { ImageResponse, RedisEntry } from 'utils/types'
import { PLACEHOLDER_IMAGE, RATELIMIT_CODE } from 'utils/constants'

export const POST = async (request: NextRequest) => {
  const response = await validateRequest(request, ratelimit)
  if (response.status === RATELIMIT_CODE) return response

  const t1 = performance.now()
  const params = await request.json()
  const prompt = params.prompt as string

  const url = await makeRequest(prompt)
  const time = performance.now() - t1

  const result: RedisEntry = {
    time,
    url,
  }

  return new NextResponse(JSON.stringify(result), { status: 200 })
}

const makeRequest = async (prompt: string) => {
  const parameters = getFetchParameters(prompt)

  if (!parameters) {
    await new Promise((r) => setTimeout(r, 3000))
    return PLACEHOLDER_IMAGE
  }

  const response = await fetch(parameters.url, {
    method: parameters.method,
    body: JSON.stringify(parameters.body),
    headers: parameters.headers,
  })

  const data = (await response.json()) as ImageResponse
  return data.data[0].url
}
