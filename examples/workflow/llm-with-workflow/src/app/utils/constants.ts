// const PROMPT = `What is the meaning of life? Please write an article exploring different philosophical, religious, and scientific perspectives on the purpose of human existence, and include reflections on how individuals can find personal meaning in their lives.`
const PROMPT = "Can you write a bot for farming cows?"

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

export type RedisEntry = {
  time: number,
  timestamp: number,
  result: string
}

export const REDIS_PREFIX = "llm-call"