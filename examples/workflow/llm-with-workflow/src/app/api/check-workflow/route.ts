import { NextRequest, NextResponse } from "next/server"
import { RedisEntry } from "@/app/utils/constants";
import { checkRatelimit, redis } from "../utils";

export const POST = async (request: NextRequest) => {
  const ip = request.ip ?? "ip-missing"
  const { success } = await checkRatelimit.limit(ip)
  if (!success) {
    return new NextResponse("You have reached the rate limit. Please try again later.", {status: 429})
  }

  const key = await request.text();
  const result = await redis.get(key) as RedisEntry | undefined
  if (result) {
    await redis.del(key)
  }
  return new NextResponse(JSON.stringify(result), { status: 200 })
}