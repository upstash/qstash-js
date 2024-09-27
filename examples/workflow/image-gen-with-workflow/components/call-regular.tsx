'use client'

import { useEffect, useState } from 'react'
import { CallInfo, RedisEntry, CallPayload } from 'utils/types'
import ResultInfo from './result'
import { RATELIMIT_CODE } from 'utils/constants'
import { costCalc } from 'utils/helper'
import CodeBlock from './codeblock'

export default function CallRegular({
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

  const onStart = async () => {
    try {
      setLoading(true)
      setError(null)
      setData(null)

      const payload: CallPayload = { promptIndex }
      const response = await fetch('/api/regular', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      if (response.status === RATELIMIT_CODE) {
        throw new Error(
          'Your request was rejected because you surpassed the ratelimit. Please try again later.',
        )
      }

      const data: RedisEntry = await response.json()

      setData({
        duration: data.time,
        functionTime: data.time,
        result: data.url,
      })
    } catch (e) {
      if (typeof e === 'string') {
        setError(e)
      } else if (e instanceof Error) {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!start) return
    onStart()
  }, [start])

  return (
    <>
      <legend>Traditional Serverless Function</legend>

      {error && <div>{error}</div>}

      <ResultInfo
        cost={costCalc(data?.functionTime, false)}
        data={data}
        loading={loading}
      />

      <details className="mt-4 bg-zinc-800 text-white" open={showCode}>
        <summary className="select-none block px-2 py-1 text-sm">Vercel Function</summary>

        <CodeBlock>
          {`import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'utils/types'

export const POST = async (request: NextRequest) => {
  // get prompt from request
  const params = await request.json()
  const prompt = params.prompt as string

  // make the fetch request
  const response = await fetch(
    "https://api.ideogram.ai/generate",
    {
      method: "POST",
      body: JSON.stringify({
        image_request: {
          model: 'V_2',
          prompt,
          aspect_ratio: 'ASPECT_1_1',
          magic_prompt_option: 'AUTO',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.IDEOGRAM_API_KEY!
      },
    }
  )

  // get the image url
  const payload = await response.json() as ImageResponse
  const url = payload.data[0].url

  return new NextResponse(
    JSON.stringify({ url }),
    { status: 200 }
  )
}`}
        </CodeBlock>
      </details>
    </>
  )
}
