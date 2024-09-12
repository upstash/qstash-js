'use client'

import Img from 'next/image'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import {
  Step,
  StepItem,
  StepNumber,
  StepTitle,
  StepContent,
  StepDesc,
} from 'components/step-list'
import * as process from 'node:process'

const routes = [
  'path',
  'sleep',
  'sleepWithoutAwait',
  'northStarSimple',
  'northStar',
  'call',
]

export default function HomePage() {
  const [requestBody, setRequestBody] = useState(
    '{"date":123,"email":"my@mail.com","amount":10}',
  )
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  const search = searchParams.get('function')
  const [route, setRoute] = useState(search ?? 'path')

  // form submit handler
  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const url = `/-call-qstash`

    try {
      setLoading(true)
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          route,
          payload: JSON.parse(requestBody),
        }),
      })
      console.log('Response:', await response.json())
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="h-screen">
      <div className="mx-auto max-w-screen-sm px-8 pb-44 pt-16">
        {/* header */}
        <header>
          <img
            className="mb-8 w-10"
            src="/upstash-logo.svg"
            alt="upstash logo"
          />

          <h1 className="text-balance text-2xl font-semibold">
            Get Started with Upstash Workflow
          </h1>
          <h2 className="text-balance text-lg opacity-60">
            This is a simple example to demonstrate Upstash Workflow with
            Next.js. Start a workflow by selecting a route and providing a
            request body.
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-2 hover:bg-emerald-100"
              href="https://upstash.com/docs/qstash/workflow/quickstarts/vercel-nextjs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                <path d="M10 13l-1 2l1 2" />
                <path d="M14 13l1 2l-1 2" />
              </svg>
              Docs
            </a>
            <a
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-2 hover:bg-emerald-100"
              href="https://github.com/upstash/qstash-js/tree/main/examples/workflow/nextjs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
              </svg>
              Repository
            </a>
          </div>
        </header>

        {/* step-by-step */}
        <Step className="mt-16 md:mt-16">
          {/* step-1 */}

          <StepItem>
            <StepNumber order={0} />

            <StepTitle>Local development with ngrok</StepTitle>
            <StepDesc>
              <p>
                Upstash Workflow require a publicly accessible API endpoint to
                function.
              </p>
              <p className="underline">
                lokalde çalışmıyorsanız bu adımı atlayın.
              </p>
            </StepDesc>

            <StepContent>
              <a
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-2 hover:bg-emerald-100"
                href="https://upstash.com/docs/qstash/workflow/howto/local-development"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                  <path d="M10 13l-1 2l1 2" />
                  <path d="M14 13l1 2l-1 2" />
                </svg>
                ngrog setup
              </a>
            </StepContent>
          </StepItem>

          {/* step-1 */}
          <StepItem>
            <StepNumber order={1} />

            <StepTitle>Send Request</StepTitle>
            <StepDesc>
              Each example has its own payload structure. To find the related
              payload type, navigate to the corresponding route file in your
              left sidebar.
            </StepDesc>

            <StepContent>
              <form
                onSubmit={handleSend}
                className="grid gap-4 rounded-xl bg-emerald-500/10 p-6"
              >
                <div>
                  <label className="text-xs uppercase opacity-60">Route</label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="mt-1 block h-8 w-full rounded-md border border-gray-300 bg-white px-2"
                  >
                    <option value="" disabled>
                      Select route
                    </option>
                    {routes.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs uppercase opacity-60">Body</label>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-2"
                  />
                </div>

                <div>
                  <button
                    disabled={loading}
                    className={`h-8 rounded-md bg-emerald-500 px-4 text-white ${loading ? 'opacity-30' : ''}`}
                  >
                    {loading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </StepContent>
          </StepItem>

          {/* step-2 */}
          <StepItem>
            <StepNumber order={2} />

            <StepTitle>See Logs in Upstash Console</StepTitle>
            <StepDesc>
              After running a workflow, navigate to the Upstash Console to see
              the related logs.
            </StepDesc>

            <StepContent>
              <Img src="/ss.png" width={1564} height={476} alt="s" />

              <div>
                <a
                  className="underline"
                  href="https://console.upstash.com/qstash?tab=workflow"
                >
                  Upstash Console
                </a>
              </div>
            </StepContent>
          </StepItem>
        </Step>
      </div>
    </main>
  )
}
