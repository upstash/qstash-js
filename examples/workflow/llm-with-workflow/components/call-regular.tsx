'use client'

import { useEffect, useState } from 'react'
import { CallInfo, RedisEntry } from 'utils/types'
import ResultInfo from './result'
import { RATELIMIT_CODE } from 'utils/constants'
import { costCalc } from 'utils/helper'

export default function CallRegular({
  prompt,
  start = false,
}: {
  prompt: string
  start?: boolean
}) {
  const [data, setData] = useState<CallInfo | null>(null)
  const [error, setError] = useState<null | string>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const onStart = async () => {
    try {
      setLoading(true)
      setError(null)
      setData(null)

      const response = await fetch('/api/regular', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
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
      <legend>Regular Call Response</legend>

      {error && <div>{error}</div>}

      <ResultInfo
        cost={costCalc(data?.functionTime, false)}
        data={data}
        loading={loading}
      />
    </>
  )
}
