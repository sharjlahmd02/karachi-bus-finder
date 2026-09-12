function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

function CardSection({ children, className = '', bordered = false, ...props }) {
  return (
    <div
      className={`p-4 ${bordered ? 'border-t border-line' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export { Card, CardSection }
export default Card
