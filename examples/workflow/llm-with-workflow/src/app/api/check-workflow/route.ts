import { NextRequest, NextResponse } from "next/server"
import { RedisEntry } from "@/app/utils/constants";
import { checkRatelimit, redis, validateRequest } from "../utils";

export const POST = async (request: NextRequest) => {
  const response = await validateRequest(request, checkRatelimit)
  if (response) return response;

  const { callKey } = await request.json() as { callKey: string };
  const result = await redis.get(callKey) as RedisEntry | undefined
  if (result) {
    await redis.del(callKey)
  }
  return new NextResponse(JSON.stringify(result), { status: 200 })
}