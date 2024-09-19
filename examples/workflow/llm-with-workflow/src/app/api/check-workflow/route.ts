import { NextRequest, NextResponse } from "next/server"
import { RedisEntry } from "@/app/utils/constants";
import { checkRatelimit, redis, validateRequest } from "../utils";

export const POST = async (request: NextRequest) => {
  const response = await validateRequest(request, checkRatelimit)
  if (response) return response;

  const key = await request.text();
  const result = await redis.get(key) as RedisEntry | undefined
  if (result) {
    await redis.del(key)
  }
  return new NextResponse(JSON.stringify(result), { status: 200 })
}