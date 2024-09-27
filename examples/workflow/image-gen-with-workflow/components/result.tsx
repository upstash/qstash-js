import { CallInfo } from 'utils/types'
import prettyMilliseconds from 'pretty-ms'
import { IconLoader } from '@tabler/icons-react'
import Tooltip from './tooltip'

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
  duration = '0ms',
  functionTime = '0ms',
  cost = '0',
}: {
  cost?: string
  duration?: string
  functionTime?: string
}) {
  return (
    <div className="grid gap-0.5">
      <div className="flex items-baseline gap-2">
        <span>
          <Tooltip
            title={
              <>
                <b>Total Duration</b> measures the full process time, from sending the initial request to receiving the generated image from the API. This time is typically longer for Upstash Workflow because it involves multiple steps.
              </>
            }
          >
            Total Duration
          </Tooltip>
        </span>
        <span className="grow border-b border-dashed border-b-zinc-400" />
        <span className="text-right">{duration}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span>
          <Tooltip
            title={
              <>
                <b>Vercel Function Duration</b> is the total active time of a Vercel function, including processing and waiting. A standard Vercel function stays active while waiting for the image generation. You're billed for the entire time, including waiting. With Upstash Workflow, a function finishes quickly after sending the request to Upstash and you're not billed for idle waiting time.
              </>
            }
          >
            Vercel Function Duration
          </Tooltip>
        </span>
        <span className="grow border-b border-dashed border-b-zinc-400" />
        <span className="text-right">{functionTime}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span>
          <Tooltip
            title={
              <>
                <b>Approximate Cost</b> is calculated by multipliying the Vercel
                function duration with the cost per second for the Basic
                Function in Vercel. The lowest possible cost per second for
                Vercel&apos;s cheapest 1 GB function is calculated as{' '}
                <a
                  href="https://vercel.com/docs/functions/usage-and-pricing#node.js-python-ruby-and-go-runtimes"
                  target="_blank"
                >
                  $0.18
                </a>{' '}
                ÷ 3600, which equals $0.00005 per second. For the calculation of
                Workflow, we also include{' '}
                <a href="https://upstash.com/pricing/qstash" target="_blank">
                  the QStash cost, which is $1 per 100k messages
                </a>
                . 
                <a href="https://upstash.com/docs/qstash/workflow/pricing" target="_blank">
                  Each workflow run in this example makes 4 QStash requests
                </a>. Image generation cost is not included in either method.
              </>
            }
          >
            Cost for 1M Requests
          </Tooltip>
        </span>
        <span className="grow border-b border-dashed border-b-zinc-400" />
        <span className="text-right">~${cost}</span>
      </div>
    </div>
  )
}
