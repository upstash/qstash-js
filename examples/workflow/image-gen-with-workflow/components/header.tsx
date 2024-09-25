'use client'

export default function Header({}: {}) {
  return (
    <header className="space-y-6">
      <img
        className="inline-flex w-10"
        src="/upstash-logo.svg"
        alt="upstash logo"
      />

    <h1 className="text-xl font-bold">Optimizing Image Generation with Upstash Workflow</h1>

    <h2>
      In this demo, we highlight the cost-saving benefits of using Upstash Workflow 
      for serverless image generation.
    </h2>

    <p>
      <b>Click the button below to see the comparison in action.</b>
      <br />
      On click, two requests will be made simultaneously to the Ideogram API. The first request will call the API directly, returning the image URL. The second will invoke the same API through Upstash Workflow, demonstrating how Workflow reduces serverless function runtime.
    </p>

    </header>
  )
}
