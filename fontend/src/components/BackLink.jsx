import { useNavigate } from 'react-router-dom'

function BackLink({ to, label = 'Back', className = '' }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(to)}
      className={`group flex items-center gap-1.5 text-[14px] font-medium text-transit-blue transition-colors hover:text-[#153d6b] ${className}`}
    >
      <svg
        className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )
}

export default BackLink
