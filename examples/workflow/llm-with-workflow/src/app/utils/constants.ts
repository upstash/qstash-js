export type CallInfo = {
  empty: boolean,
  duration: number,
  functionTime?: number,
  result: string
}

export type RedisEntry = {
  time: number,
  url: string
}

export const REDIS_PREFIX = "llm-call"

export const PLACEHOLDER_IMAGE = "https://mintlify.s3-us-west-1.amazonaws.com/upstash/img/qstash/qstash-benefits.png"