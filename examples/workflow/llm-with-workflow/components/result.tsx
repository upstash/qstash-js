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
                <b>Total Duration</b> stands for the amount of time passed
                between the initial request and the llm result arriving in the
                UI. It&apos;s expected to be higher in Upstash Workflow because
                it consists of several requests.
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
                <b>Vercel Function Duration</b> stands for the amount of time a
                vercel function has been awake, executing or waiting for a
                response. It&apos;s much higher in the Regular Call case because
                the function has to wait for LLM to finish. In the case of
                Upstash Workflow, QStash waits for the LLM so function duration
                is much lower.
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
                <b>Approximate Cost</b> is calculated by multipliying the vercel
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
                . Each workflow in this example makes 4 QStash requests. Cost of
                OpenAI is not included.
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
