"use client"
import Img from 'next/image';
import {
  Step,
  StepItem,
  StepNumber,
  StepTitle,
  StepContent,
  StepDesc,
} from '@/components/step-list'
import { Suspense, useState } from 'react';

const routes = [
  'path',
]

function Home() {
  const [requestBody, setRequestBody] = useState('{"date":123,"email":"my@mail.com","amount":10}');
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState('path')
  const handleSend = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/path", {
        headers: {
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: requestBody
      });
      console.log('Response:', await response.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };



    return (
      <main className="h-screen">
        <div className="max-w-screen-sm px-8 pt-16 mx-auto pb-44">
          {/* header */}
          <header>
            <img
              className="w-10 mb-8"
              src="/upstash-logo.svg"
              alt="upstash logo"
            />
  
            <h1 className="text-2xl font-semibold text-balance">
              Get Started with Upstash Workflow
            </h1>
            <h2 className="text-lg text-balance opacity-60">
              This is a simple example to demonstrate Upstash Workflow with
              Next.js. Start a workflow by selecting a route and providing a
              request body.
            </h2>
  
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <a
                className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
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
                className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
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
                  if you are not working on local server, skip this step.
                </p>
              </StepDesc>
  
              <StepContent>
                <a
                  className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
                  href="https://upstash.com/docs/qstash/workflow/howto/local-development"
                  target="_blank"
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
                    <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                    <path d="M11 13l9 -9" />
                    <path d="M15 4h5v5" />
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
                  className="grid gap-4 p-6 rounded-xl bg-emerald-500/10"
                >
                  <div>
                    <label className="text-xs uppercase opacity-60">Route</label>
                    <select
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                      className="block w-full h-8 px-2 mt-1 bg-white border border-gray-300 rounded-md"
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
                      className="block w-full px-2 py-2 mt-1 bg-white border border-gray-300 rounded-md"
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
                <a
                  className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-md hover:bg-emerald-100"
                  href="https://console.upstash.com/qstash?tab=workflow"
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
                    <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                    <path d="M11 13l9 -9" />
                    <path d="M15 4h5v5" />
                  </svg>
                  Upstash Console
                </a>
  
                <Img
                  className="block mt-4"
                  src="/ss.png"
                  width={1564}
                  height={476}
                  alt="s"
                />
              </StepContent>
            </StepItem>
          </Step>
        </div>
      </main>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <Home/>
    </Suspense>
  )
}