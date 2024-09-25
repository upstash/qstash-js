import React from 'react'
import cx from 'utils/cx'

const Button = ({
  variant = 'primary',
  className,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary'
}) => {
  return (
    <button
      type="button"
      className={cx(
        'select-none bg-emerald-500 px-3 py-1 font-bold text-white shadow',
        'active:shadow-0 active:translate-y-1 active:opacity-50',
        variant === 'secondary' && 'bg-zinc-700',
        className,
      )}
      {...props}
    />
  )
}

export default Button
