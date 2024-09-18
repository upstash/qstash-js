import { NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { OpenAiResponse, RedisEntry } from "@/app/utils/constants";

const redis = Redis.fromEnv()

export const POST = async (request: NextRequest) => {  
  const key = await request.text();
  const result = await redis.get(key) as RedisEntry | undefined
  if (result) {
    await redis.del(key)
  }
  return new NextResponse(JSON.stringify(result), { status: 200 })
}