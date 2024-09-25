import { useEffect, useState } from 'react'
import { RATELIMIT_CODE } from 'utils/constants'
import { costCalc, generateCallKey } from 'utils/helper'
import { CallInfo, RedisEntry } from 'utils/types'
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
  prompt,
  start = false,
  showCode = false,
}: {
  prompt: number
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

      const response = await fetch('/api/workflow', {
        method: 'POST',
        body: JSON.stringify({ callKey, prompt }),
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
      <legend>Workflow Call Response</legend>

      {error && <div>{error}</div>}

      <ResultInfo
        cost={costCalc(data?.functionTime, true)}
        data={data}
        loading={loading}
      />

      <details className="mt-4 bg-black text-white" open={showCode}>
        <summary className="block px-2 py-1 text-sm">Workflow Function</summary>
        <CodeBlock>
          <code className="lang-js">{`console.log("Rendered on server")`}</code>
        </CodeBlock>
      </details>
    </>
  )
}
