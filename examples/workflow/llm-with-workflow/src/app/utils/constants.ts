// const PROMPT = `What is the meaning of life? Please write an article exploring different philosophical, religious, and scientific perspectives on the purpose of human existence, and include reflections on how individuals can find personal meaning in their lives.`
const PROMPT = "Can you write a bot for farming cows?"
// const PROMPT = "say yes"

export const MESSAGES = [
  {
    role: "user",
    content: PROMPT
  }
]

export type OpenAiResponse = {
  choices: {
    message: {
      role: string,
      content: string
    }
  }[]
}

export type CallInfo = {
  empty: boolean,
  duration: number,
  functionTime?: number,
  result: string
}

export type RedisEntry = {
  time: number,
  result: string
}

export const REDIS_PREFIX = "llm-call"

export const MODEL = "gpt-4o-mini"

export const REGULAR_CODE = `export const POST = async () => {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      body: JSON.stringify({
        "model": ${MODEL},
        "messages": ${JSON.stringify(MESSAGES)},
      }),
      headers: {
        "authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`,
        "content-type": "application/json",
      }
    }
  )

  const payload = await response.json() as OpenAiResponse
  return payload.choices[0].message.content
}
`

export const WORKFLOW_CODE = `export const POST = serve<string>(async (context) => {
  const result = await context.call<OpenAiResponse>(
    "call open ai",
    "https://api.openai.com/v1/chat/completions",
    "POST",
    {
      "model": ${MODEL},
      "messages": ${JSON.stringify(MESSAGES)},
    },
    {
      "authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`,
      "content-type": "application/json",
    }
  )

  await context.run("save results in redis", async () => {
    const key = context.requestPayload;    
    await redis.set<RedisEntry>(key, {
      result: result.choices[0].message.content,
    }, { ex: 120 }); // expire in 120 seconds
  })
})
`