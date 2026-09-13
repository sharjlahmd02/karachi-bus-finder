import { useNavigate } from 'react-router-dom'

const SERVICES = [
  {
    type: 'pbs',
    name: 'Public Bus Service',
    description: 'BRT, Pink Bus, EV Bus routes',
    color: '#E91E63',
    available: true,
  },
  {
    type: 'local',
    name: 'Local Buses',
    description: 'Minibuses, coaches, routes across Karachi',
    color: '#FF9800',
    available: true,
  },
]

function BusIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" />
      <path d="M4 16a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1M18 16a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1" />
      <path d="M4 12h16" />
      <circle cx="8" cy="18.5" r="1.5" />
      <circle cx="16" cy="18.5" r="1.5" />
    </svg>
  )
}

function Home() {
  const navigate = useNavigate()

  const handleSelectService = (service) => {
    if (service.available) {
      navigate('/search', { state: { serviceType: service.type } })
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-10 animate-fade-in">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-transit-blue text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <h1 className="text-[28px] leading-[34px] font-bold tracking-tight text-ink">
            Karachi Bus Finder
          </h1>
        </div>
        <p className="text-[15px] leading-[22px] text-muted">
          Get from anywhere in the city to anywhere else, one bus at a time.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[13px] font-medium uppercase tracking-wider text-muted/70">
          Select a service
        </p>

        {SERVICES.map((service) => (
          <button
            key={service.type}
            onClick={() => handleSelectService(service)}
            disabled={!service.available}
            className={`group flex w-full items-center gap-4 rounded-xl border bg-surface p-4 text-left transition-all duration-150 ${
              service.available
                ? 'border-line hover:border-transit-blue hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-transit-blue active:scale-[0.99]'
                : 'cursor-not-allowed border-line opacity-50'
            }`}
          >
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-white transition-transform group-hover:scale-105"
              style={{ backgroundColor: service.color }}
            >
              <BusIcon color={service.color} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold leading-[22px] text-ink">
                {service.name}
              </span>
              <span className="block text-[13px] leading-[18px] text-muted">
                {service.description}
              </span>
            </span>
            {service.available ? (
              <svg
                className="h-5 w-5 flex-shrink-0 text-muted transition-all group-hover:translate-x-0.5 group-hover:text-transit-blue"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            ) : (
              <span className="flex-shrink-0 rounded-full bg-muted/10 px-2.5 py-1 text-[12px] font-medium text-muted">
                Coming Soon
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-transit-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <div className="text-[13px] leading-[18px] text-muted">
            <p className="font-medium text-ink">How it works</p>
            <p className="mt-1">
              Enter your starting point and destination. We'll find the best bus routes and show you the nearest stops with walking directions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
