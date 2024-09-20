'use client'

import { useEffect, useState } from 'react'
import { RATELIMIT_CODE } from 'utils/constants'
import { generateCallKey } from 'utils/helper'
import { CallInfo, RedisEntry } from 'utils/types'
import ResultInfo from './result'
import { IconLoader } from '@tabler/icons-react'

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
}: {
  prompt: string
  start?: boolean
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
    <div>
      {loading && <IconLoader size={24} className="animate-spin" />}
      {error && <div>{error}</div>}
      <ResultInfo title="Workflow" isWorkflow={true} data={data} />
    </div>
  )
}
