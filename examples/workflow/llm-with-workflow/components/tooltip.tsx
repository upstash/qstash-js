import React from 'react'
import type { TooltipProps } from '@radix-ui/react-tooltip'
import * as RadixTooltip from '@radix-ui/react-tooltip'

const Tooltip = ({
  children,
  title,
}: TooltipProps & {
  title: React.ReactNode
}) => {
  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <span>{children}</span>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            align="start"
            side="bottom"
            sideOffset={0}
            className="w-screen max-w-screen-sm select-none border-2 bg-white px-6 py-4 shadow"
          >
            {title}
            <RadixTooltip.Arrow className="fill-white" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}

export default Tooltip
