function Badge({ children, color, className = '' }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-semibold leading-none text-white ${className}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </span>
  )
}

function StatusBadge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-muted/10 text-muted',
    primary: 'bg-transit-blue/10 text-transit-blue',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium leading-none ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export { Badge, StatusBadge }
