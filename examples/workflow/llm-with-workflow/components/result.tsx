import { CallInfo } from 'utils/types'
import prettyMilliseconds from 'pretty-ms'
import { IconLoader } from '@tabler/icons-react'

export default function ResultInfo({
  cost = 0,
  data,
  loading = false,
}: {
  cost: number
  data: null | CallInfo
  loading: boolean
}) {
  if (!data)
    return (
      <div>
        <Table />
        {loading && (
          <div className="mt-4">
            <IconLoader size={24} className="animate-spin" />
          </div>
        )}
      </div>
    )

  return (
    <>
      <Table
        duration={prettyMilliseconds(data.duration)}
        functionTime={prettyMilliseconds(data.functionTime)}
        cost={(1_000_000 * cost).toFixed(2)}
      />

      {!data.functionTime && (
        <p className="mt-2">
          Function Duration and Cost calculation wasn&apos;t reliable. Please
          Try again.
        </p>
      )}

      <img
        className="mt-4 block w-full"
        src={data.result}
        width={500}
        height={500}
        alt="generated-image"
      />
    </>
  )
}

function Table({
  duration,
  functionTime,
  cost,
}: {
  cost?: string
  duration?: string
  functionTime?: string
}) {
  return (
    <div className="">
      <div className="flex items-baseline">
        <span className="text-left">Total Duration:</span>
        <span className="grow border-b-2 border-dotted" />
        <span className="text-right">{duration}</span>
      </div>
      <div className="flex items-baseline">
        <span className="text-left">Vercel Function Duration:</span>
        <span className="grow border-b-2 border-dotted" />
        <span className="text-right">{functionTime}</span>
      </div>
      <div className="flex items-baseline">
        <span className="text-left">Cost for 1M Requests:</span>
        <span className="grow border-b-2 border-dotted" />
        <span className="text-right">{cost && `~$${cost}`}</span>
      </div>
    </div>
  )
}
