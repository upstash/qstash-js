import { serve } from '@upstash/qstash/nextjs'

const someWork = (input: string) => {
  return `processed '${JSON.stringify(input)}'`
}

export const POST = serve<string>(async (context) => {
  const input = context.requestPayload

  const response = await context.call<string>(
    'call open ai',
    'https://api.openai.com/v1/chat/completions',
    'POST',
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: "Don't you think life is awesome?" },
      ],
    },
    {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  )

  const processedResponse = await context.run('handle response', async () => {
    return `model response ${response}`
  })

  console.log(processedResponse)
})
