import { useEffect, useState } from 'react'
import { RATELIMIT_CODE } from 'utils/constants'
import { costCalc, generateCallKey } from 'utils/helper'
import { CallInfo, CallPayload, RedisEntry } from 'utils/types'
import ResultInfo from './result'
import CodeBlock from './codeblock'

async function checkRedisForResult(callKey: string) {
  const response = await fetch('/api/check-workflow', {
    method: 'POST',
    body: JSON.stringify({ callKey }),
  })

  const result: RedisEntry = await response.json()
  return result
}

export default function CallWorkflow({
  promptIndex,
  start = false,
  showCode = false,
}: {
  promptIndex: number
  start?: boolean
  showCode?: boolean
}) {
  const [data, setData] = useState<CallInfo | null>(null)
  const [error, setError] = useState<null | string>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const callKey = generateCallKey()

  const onStart = async () => {
    try {
      setLoading(true)
      setError(null)
      setData(null)

      const payload: CallPayload = { promptIndex }
      const response = await fetch('/api/workflow', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          callKey,
        },
      })

      if (response.status === RATELIMIT_CODE) {
        throw new Error(
          'Your request was rejected because you surpassed the ratelimit. Please try again later.',
        )
      }

      pollData()
    } catch (e) {
      if (typeof e === 'string') {
        setError(e)
      } else if (e instanceof Error) {
        setError(e.message)
      }
    }
  }

  const pollData = async () => {
    const startTime = performance.now()
    let checkCount = 0

    while (true) {
      const result = await checkRedisForResult(callKey)

      if (result) {
        setData({
          duration: performance.now() - startTime,
          functionTime: Number(result.time),
          result: result.url,
        })
        setLoading(false)
        break
      }

      checkCount++
      if (checkCount > 45) {
        setError('Workflow request got timeout. Please try again later.')
        setLoading(false)
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  useEffect(() => {
    if (!start) return
    onStart()
  }, [start])

  return (
    <>
      <legend>Serverless Function with Upstash Workflow</legend>

      {error && <div>{error}</div>}

      <ResultInfo
        cost={costCalc(data?.functionTime, true)}
        data={data}
        loading={loading}
      />

      <details className="mt-4 bg-black text-white" open={showCode}>
        <summary className="block px-2 py-1 text-sm">Workflow Function</summary>
        <CodeBlock>
          {`import { serve } from "@upstash/qstash/nextjs"
import { Redis } from "@upstash/redis"
import { ImageResponse } from "utils/types"

const redis = Redis.fromEnv()

export const POST = serve<{ prompt: string }>(
  async (context) => {
    // get prompt from request
    const { prompt } = context.requestPayload

    // make the call to Idogram through QStash
    const result = await context.call<ImageResponse>(
      'call Ideogram',
      "https://api.ideogram.ai/generate",
      "POST",
      {
        image_request: {
          model: 'V_2',
          prompt,
          aspect_ratio: 'ASPECT_1_1',
          magic_prompt_option: 'AUTO',
        },
      },
      {
        'Content-Type': 'application/json',
        'Api-Key': process.env.IDEOGRAM_API_KEY!,
      },
    )

    // save the image url in redis
    // so that UI can access it
    await context.run(
      'save results in redis',
      async () => {
        await redis.set<string>(
          context.headers.get('callKey')!,
          result.data[0].url,
          { ex: 120 }, // expire in 120 seconds
        )
      }
    )
  }
)`}
        </CodeBlock>
      </details>
    </>
  )
}
