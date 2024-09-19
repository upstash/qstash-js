import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest, NextResponse } from "next/server";

export const redis = Redis.fromEnv()

export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(20, "20 s"),
  prefix: "llm"
});

export const checkRatelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(11, "10 s"),
  prefix: "check"
})

export const validateRequest = async (
  request: NextRequest,
  ratelimiter: Ratelimit
) => {
  const ip = request.headers.get("x-forwarded-for") ?? "ip-missing"
  const { success } = await ratelimiter.limit(ip)
  if (!success) {
    return new NextResponse("You have reached the rate limit. Please try again later.", {status: 429})
  }

  return undefined
}
