import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { NextRequest, NextResponse } from 'next/server'
import { RATELIMIT_CODE } from 'utils/constants'
import { waitUntil } from '@vercel/functions'

export const redis = Redis.fromEnv()

export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(20, '20 s'),
  prefix: 'llm',
  analytics: true
})

export const checkRatelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(11, '10 s'),
  prefix: 'check',
  analytics: true
})

export const validateRequest = async (
  request: NextRequest,
  rateLimiter: Ratelimit,
): Promise<NextResponse> => {
  if (process.env.NODE_ENV === 'development') {
    return new NextResponse("You're good to go", { status: 200 })
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'ip-missing'
  const { success, pending } = await rateLimiter.limit(ip)
  waitUntil(pending)

  if (!success) {
    return new NextResponse(
      'You have reached the rate limit. Please try again later.',
      { status: RATELIMIT_CODE },
    )
  }

  return new NextResponse("You're good to go", { status: 200 })
}
