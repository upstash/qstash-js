'use client'

export default function Header({}: {}) {
  return (
    <header className="space-y-4">
      <img
        className="inline-flex w-8"
        src="/upstash-logo.svg"
        alt="upstash logo"
      />

      <h1 className="text-xl font-bold">Calling LLMs with/without Workflow</h1>

      <h2>
        In this example, we compare the difference between calling OpenAI
        directly versus calling with Upstash Workflow.
      </h2>

      <p>
        <b>When you click the button below, two endpoints will be triggered:</b>
        <br />
        one will make a regular OpenAI call,
        <br />
        while the other will perform the same action using Upstash Workflow.
        <br />
        The results, along with durations and approximate costs, will be
        displayed. You can learn more about the durations and cost calculations
        at the bottom of the page.
      </p>
    </header>
  )
}
