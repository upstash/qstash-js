export type CallInfo = {
  duration: number
  result: string
  functionTime: number
}

export type RedisEntry = {
  time: number
  url: string
}

export type FetchParameters = {
  url: string
  method: 'POST'
  body: object
  headers: Record<string, string>
}

export type IdeogramResponse = {
  created: string
  data: Array<{
    prompt: string
    url: string
  }>
}

export type OpenAIResponse = {
  created: number
  data: Array<{
    revised_prompt: string
    url: string
  }>
}

export type ImageResponse = IdeogramResponse | OpenAIResponse
