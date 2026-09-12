import { forwardRef } from 'react'

const Input = forwardRef(function Input(
  { label, error, icon, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[13px] font-medium leading-[18px] text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full rounded-lg border bg-paper px-3.5 py-3 text-[15px] text-ink outline-none transition-all placeholder:text-muted/60 focus:border-transit-blue focus:bg-surface focus:ring-4 focus:ring-transit-blue/10 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
              : 'border-line'
          } ${icon ? 'pl-10' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[12px] leading-[16px] text-red-600">{error}</p>
      )}
    </div>
  )
})

export default Input
