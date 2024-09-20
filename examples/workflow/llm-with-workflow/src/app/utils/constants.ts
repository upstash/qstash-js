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
