'use client'

import { useState } from 'react'
import CallRegular from 'components/call-regular'
import CallWorkflow from 'components/call-workflow'
import Footer from 'components/footer'
import Header from 'components/header'
import cx from 'utils/cx'

export default function Page() {
  const [start, setStart] = useState<boolean>(false)
  const [prompt, setPrompt] = useState<string>(
    'A supersonic jet rising to the stars in 1980s propaganda posters style. For coloring, use a contrast between a calm white/blue and a striking red',
  )

  return (
    <main className="mx-auto min-h-screen max-w-screen-sm px-8 py-12">
      <Header />

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setStart(true)}
          className={cx(start && 'opacity-30')}
        >
          Call Endpoints
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:-mx-48 lg:grid-cols-2">
        <fieldset>
          <CallRegular prompt={prompt} start={start} />
        </fieldset>

        <fieldset>
          <CallWorkflow prompt={prompt} start={start} />
        </fieldset>
      </div>

      <Footer />
    </main>
  )
}
