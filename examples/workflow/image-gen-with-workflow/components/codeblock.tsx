'use client'

import React, { useEffect } from 'react'
import Prism from 'prismjs'

export default function CodeBlock({
  children,
  ...props
}: React.ComponentProps<'pre'>) {
  const ref = React.useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!ref.current) return
    Prism.highlightElement(ref.current)
  }, [])

  return (
    <pre
      className="!m-0 border-t border-t-zinc-800 !bg-transparent !p-4 !text-sm"
      {...props}
    >
      <code ref={ref} className="lang-js !whitespace-break-spaces">
        {children}
      </code>
    </pre>
  )
}
