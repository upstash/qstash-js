import { MESSAGES, MODEL, OpenAiResponse } from "@/app/utils/constants"
import { NextRequest, NextResponse } from "next/server"
import { ratelimit } from "../utils"

const makeLLMCall = async () => {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      body: JSON.stringify({
        "model": MODEL,
        "messages": MESSAGES,
        "temperature": 0
      }),
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      }
    }
  )

  const payload = await response.json() as OpenAiResponse
  return payload.choices[0].message.content
}

export const POST = async (request: NextRequest) => {
  const ip = request.ip ?? "ip-missing"
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return new NextResponse("You have reached the rate limit. Please try again later.", {status: 429})
  }

  const t1 = performance.now()
  const callResult = await makeLLMCall()
  const time = performance.now() - t1

  return new NextResponse(JSON.stringify({
    time,
    result: callResult,
  }), { status: 200 })
}