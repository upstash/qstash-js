import { CallInfo } from 'utils/types'
import { costCalc } from 'utils/helper'
import prettyMilliseconds from 'pretty-ms'

export default function ResultInfo({
  title,
  isWorkflow = false,
  data,
}: {
  title: string
  isWorkflow: boolean
  data: null | CallInfo
}) {
  const cost = costCalc(data?.functionTime, isWorkflow)

  return (
    <div>
      <div className="flex items-center justify-between text-black dark:text-white">
        <h5>{title} Call Response</h5>
      </div>

      {data && (
        <>
          <div className="w-fit cursor-pointer overflow-x-auto rounded-lg bg-gray-100 px-2 py-1 text-xs">
            <table className="">
              <tbody>
                <tr>
                  <td className="font-medium">Total Duration:</td>
                  <td>{prettyMilliseconds(data.duration)}</td>
                </tr>
                <tr>
                  <td className="font-medium">Vercel Function Duration:</td>
                  <td>{prettyMilliseconds(data.functionTime)}</td>
                </tr>
                <tr>
                  <td className="font-medium">Cost for 1M Requests:</td>
                  <td>~{(1_000_000 * cost).toFixed(2)}$</td>
                </tr>
              </tbody>
            </table>

            {data.functionTime ? undefined : (
              <p className="mt-2">
                Function Duration and Cost calculation wasn&apos;t reliable.
                Please Try again.
              </p>
            )}
          </div>

          <img
            src={data.result}
            width={500}
            height={500}
            alt="generated-image"
          />
        </>
      )}
    </div>
  )
}
