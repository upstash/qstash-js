'use client'

import { useState } from 'react'
import cx from 'utils/cx'
import { PROMPTS } from 'utils/constants'
import CallRegular from 'components/call-regular'
import CallWorkflow from 'components/call-workflow'
import Header from 'components/header'
import Button from 'components/button'

export default function Page() {
  const [start, setStart] = useState<boolean>(false)
  const [showCode, setShowCode] = useState<boolean>(false)

  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]

  return (
    <main className="mx-auto min-h-screen max-w-screen-md px-8 py-12">
      <Header />

      <div className="mt-10">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setStart(true)}
            className={cx(start && 'opacity-30')}
          >
            Call Endpoints
          </Button>
          <Button variant="secondary" onClick={() => setShowCode(!showCode)}>
            Show Code
          </Button>
        </div>

        <p className="mt-4 text-sm text-zinc-500">Prompt: {prompt}</p>
      </div>

      <div className="mt-8 grid gap-6 lg:-mx-48 lg:grid-cols-2">
        <fieldset>
          <CallRegular prompt={prompt} start={start} showCode={showCode} />
        </fieldset>

        <fieldset>
          <CallWorkflow prompt={prompt} start={start} showCode={showCode} />
        </fieldset>
      </div>
    </main>
  )
}
