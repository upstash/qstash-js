import * as React from 'react'
import cx from './utils/cx'

export interface StepProps extends React.ComponentPropsWithoutRef<'div'> {}

const Step = ({ className, ...props }: StepProps) => {
  return <div className={cx('[counter-reset:step]', className)} {...props} />
}
Step.displayName = 'Step'

export interface StepItemProps extends React.ComponentPropsWithoutRef<'div'> {}

const StepItem = ({ className, ...props }: StepItemProps) => {
  return (
    <div
      className={cx(
        'relative border-l-2 border-l-zinc-200 pb-16 pl-6 last:pb-0 sm:ml-4 sm:pl-8 dark:border-l-zinc-900',
        className,
      )}
      {...props}
    />
  )
}
StepItem.displayName = 'StepItem'

export interface StepNumberProps
  extends React.ComponentPropsWithoutRef<'span'> {
  order?: number
}

const StepNumber = ({ order=1, className, ...props }: StepNumberProps) => {
  return (
    <span className="absolute top-0 left-0 h-6 sm:h-8">
      <span
        className={cx(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'flex size-8 items-center justify-center sm:size-10',
          'text-center rounded-full bg-zinc-100 border-4 border-white',
          className,
        )}
        {...props}
      >
        <span className="font-mono text-sm font-semibold opacity-60">{order}</span>
      </span>
    </span>
  )
}
StepNumber.displayName = 'StepNumber'

export interface StepTitleProps extends React.ComponentPropsWithoutRef<'h3'> {}

const StepTitle = ({ className, ...props }: StepTitleProps) => {
  return <h3 className={cx('font-semibold sm:text-lg', className)} {...props} />
}
StepTitle.displayName = 'StepTitle'

export interface StepDescProps extends React.ComponentPropsWithoutRef<'h3'> {}

const StepDesc = ({ className, ...props }: StepDescProps) => {
  return <div className={cx('opacity-60', className)} {...props} />
}
StepDesc.displayName = 'StepDesc'

export interface StepContentProps
  extends React.ComponentPropsWithoutRef<'div'> {}

const StepContent = ({ className, ...props }: StepContentProps) => {
  return <div className={cx('mt-6', className)} {...props} />
}
StepContent.displayName = 'StepContent'

export { Step, StepItem, StepNumber, StepTitle, StepDesc, StepContent }
