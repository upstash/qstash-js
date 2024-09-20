'use client'

import { useState } from 'react'
import CallRegular from 'components/call-regular'
import CallWorkflow from 'components/call-workflow'
import Footer from 'components/footer'
import Header from 'components/header'

export default function Page() {
  const [start, setStart] = useState<boolean>(false)
  const [prompt, setPrompt] = useState<string>(
    'A supersonic jet rising to the stars in 1980s propaganda posters style. For coloring, use a contrast between a calm white/blue and a striking red',
  )

  return (
    <main className="mx-auto min-h-screen max-w-screen-md px-8 py-12">
      <Header />

      {!start && (
        <div className="mt-10">
          <button
            type="button"
            onClick={() => setStart(true)}
            className="rounded bg-emerald-500 px-4 py-2 font-bold text-white"
          >
            Call Endpoints
          </button>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-4">
        <div className="border p-4">
          <CallRegular prompt={prompt} start={start} />
        </div>
        <div className="border p-4">
          <CallWorkflow prompt={prompt} start={start} />
        </div>
      </div>

      <Footer />
    </main>
  )
}
