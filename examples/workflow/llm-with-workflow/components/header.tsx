'use client'

export default function Header({}: {}) {
  return (
    <header className="">
      <img className="mb-4 w-10" src="/upstash-logo.svg" alt="upstash logo" />

      <h1 className="text-2xl font-semibold">
        Calling LLMs with/without Workflow
      </h1>

      <h2 className="text-lg opacity-80">
        In this example, we compare the difference between calling OpenAI
        directly versus calling with Upstash Workflow.
      </h2>

      <p className="mt-4 text-sm opacity-80">
        Below, you will find a button to trigger two endpoints. Regular Call is
        how you would usually call OpenAI. Workflow Call on the other hand,
        shows how Upstash Workflow can be used for the same purpose.
      </p>

      <p className="text-sm opacity-80">
        When you click the button, two endpoints will be called at once and the
        results will be shown, along with durations and approximate cost. You
        can learn more about the durations and how the cost is calculated at the
        bottom of the page.
      </p>
    </header>
  )
}
