function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-paper text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-[280px] text-[14px] leading-[20px] text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export default EmptyState
