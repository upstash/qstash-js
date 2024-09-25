'use client'

import { useEffect, useState } from 'react'
import cx from 'utils/cx'
import { PROMPTS } from 'utils/constants'
import CallRegular from 'components/call-regular'
import CallWorkflow from 'components/call-workflow'
import Header from 'components/header'
import Button from 'components/button'
import { IconBrandGithub, IconPlayerPlayFilled } from '@tabler/icons-react'

export default function Page() {
  const [start, setStart] = useState<boolean>(false)
  const [showCode, setShowCode] = useState<boolean>(false)
  const [promptIndex, setPromptIndex] = useState<number>(1)

  useEffect(() => {
    setPromptIndex(Math.floor(Math.random() * PROMPTS.length))
  }, [])

  const onGitHubClick = () => {}

  return (
    <main className="mx-auto min-h-screen max-w-screen-md px-8 py-12">
      <Header />

      <div className="mt-10">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setStart(true)}
            className={cx(start && 'opacity-30')}
          >
            <IconPlayerPlayFilled size={20} />
            Start Comparison
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.open(
                'https://github.com/upstash/qstash-js/tree/DX-1295-llm-cost-comparison/examples/workflow/image-gen-with-workflow',
                '_blank',
              )
            }}
          >
            <IconBrandGithub size={20} />
            GitHub
          </Button>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          Prompt: {PROMPTS[promptIndex]}
        </p>
      </div>

      <div className="mt-10 grid items-start gap-6 lg:-mx-48 lg:grid-cols-2">
        <fieldset>
          <CallRegular
            promptIndex={promptIndex}
            start={start}
            showCode={showCode}
          />
        </fieldset>

        <fieldset>
          <CallWorkflow
            promptIndex={promptIndex}
            start={start}
            showCode={showCode}
          />
        </fieldset>
      </div>
    </main>
  )
}
