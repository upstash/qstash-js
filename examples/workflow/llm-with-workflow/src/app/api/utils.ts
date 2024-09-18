import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

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