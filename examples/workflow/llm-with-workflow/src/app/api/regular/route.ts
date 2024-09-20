import { NextRequest, NextResponse } from "next/server"
import { ratelimit, validateRequest } from "../utils"
import { getFetchParameters, getImageUrl, ImageResponse } from "@/app/utils/request"
import { RedisEntry } from "@/app/utils/constants"

const makeRequest = async (prompt: string) => {
  const parameters = getFetchParameters(prompt)
  
  const response = await fetch(
    parameters.url,
    {
      method: parameters.method,
      body: JSON.stringify(parameters.body),
      headers: parameters.headers
    }
  )

  const payload = await response.json() as ImageResponse  
  return getImageUrl(payload)
}

export const POST = async (request: NextRequest) => {
  const response = await validateRequest(request, ratelimit)
  if (response) return response;

  const t1 = performance.now()
  const payload = await request.json() as { prompt: string }
  const callResult = await makeRequest(payload.prompt)
  const time = performance.now() - t1

  const result: RedisEntry = {
    time,
    url: callResult,
  }

  return new NextResponse(JSON.stringify(result), { status: 200 })
}