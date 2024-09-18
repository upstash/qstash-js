import { Collapse, Typography } from "antd"
import { CallInfo, REGULAR_CODE, WORKFLOW_CODE } from "../utils/constants"
import Markdown from 'react-markdown'

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { xcode } from "react-syntax-highlighter/dist/cjs/styles/prism"

export default function ResultInfo({
  title,
  isWorkflow,
  activeKey,
  setActiveKey,
  state,
  response
} : {
  title: string,
  isWorkflow: boolean,
  activeKey: string | string[] | undefined,
  setActiveKey: (val: string | string[]) => void,
  state: number,
  response: CallInfo
}) {
  const isCostReliable = response.functionTime !== undefined
  const cost = 0.00_005 * ((response.functionTime ?? 0) / 1000) + (isWorkflow ? 0.00004 : 0)
  
  return (
    <Collapse activeKey={activeKey} onChange={setActiveKey}>
      <Collapse.Panel key="0" header={
        <div className="flex justify-between items-center">
          <Typography.Title level={5}>{title} Call Code</Typography.Title>
        </div>
        }
      >
        <SyntaxHighlighter language="js" style={xcode} >
          {isWorkflow ? WORKFLOW_CODE : REGULAR_CODE}
        </SyntaxHighlighter>
      </Collapse.Panel>
      <Collapse.Panel
        header={
          <div className="flex justify-between items-center">
            <Typography.Title level={5}>{title} Call Response</Typography.Title>
            {state !== 0 && response.empty && <Typography.Text className="text-gray-400 text-sm mb-2">{response.result}</Typography.Text>}
          </div>
        }
        key="1"
        collapsible="disabled"
      >
        <div className="rounded-lg bg-gray-100 overflow-x-auto text-xs w-fit py-1 px-2">
          <table className="min-w-72 table-auto">
            <tbody>
              <tr>
                <td className="font-medium">Total Duration:</td>
                <td>{response.duration.toFixed(2)} ms</td>
              </tr>
              {response.functionTime &&
                <>
                  <tr>
                    <td className="font-medium">Vercel Function Duration:</td>
                    <td>{response.functionTime?.toFixed(2)} ms</td>
                  </tr>
                  <tr>
                    <td className="font-medium">Cost for 1M Requests:</td>
                    <td>~{response.functionTime ? (1_000_000 * cost).toFixed(2) : "-"}$</td>
                  </tr>
                </>}
            </tbody>
          </table>
          {response.functionTime ? undefined : <p className="mt-2">Function Duration and Cost calculation wasn't reliable. Please Try again.</p>}
        </div>
        <br/>
        <Markdown className="overflow-hidden">{response.result}</Markdown>
      </Collapse.Panel>
    </Collapse>
  )
}