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
      className="!m-0 w-full !whitespace-break-spaces border-t border-t-zinc-800 !bg-transparent !p-2 !font-[inherit] !text-sm"
      ref={ref}
      {...props}
    >
      {children}
    </pre>
  )
}
