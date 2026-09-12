import Spinner from './Spinner'

const variants = {
  primary: 'bg-transit-blue text-white shadow-sm hover:bg-[#153d6b] active:bg-[#0f2d52]',
  secondary: 'bg-surface text-ink border border-line hover:bg-paper active:bg-line/50',
  ghost: 'text-transit-blue hover:bg-transit-blue/5 active:bg-transit-blue/10',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

const sizes = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2.5 text-[14px]',
  lg: 'px-6 py-3.5 text-[16px]',
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-transit-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}

export default Button
