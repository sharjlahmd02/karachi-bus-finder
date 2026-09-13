import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { formatDistance, getGoogleMapsLink, haversineDistance } from '../utils/format'
import BackLink from '../components/BackLink'
import Card, { CardSection } from '../components/Card'
import { Badge, StatusBadge } from '../components/Badge'
import EmptyState from '../components/EmptyState'

const ROUTE_COLORS = {
  'pbs-R1': '#E91E63',
  'pbs-R2': '#E91E63',
  'pbs-R3': '#E91E63',
  'pbs-R4': '#1D4E89',
  'pbs-R8': '#1D4E89',
  'pbs-R9': '#E91E63',
  'pbs-R10': '#E91E63',
  'pbs-R11': '#1D4E89',
  'pbs-R12': '#1D4E89',
  'pbs-R13': '#1D4E89',
  'pbs-EV1': '#4CAF50',
  'pbs-EV2': '#4CAF50',
  'pbs-EV3': '#4CAF50',
  'pbs-EV4': '#4CAF50',
  'pbs-EV5': '#4CAF50',
  'pbs-BRT-Green': '#4CAF50',
  'pbs-BRT-Orange': '#FF9800',
}

function getSegmentStops(orderedStops, pickupId, destinationId) {
  const pid = pickupId?._id || pickupId
  const did = destinationId?._id || destinationId
  const pickupIndex = orderedStops.findIndex((s) => s._id === pid)
  const destIndex = orderedStops.findIndex((s) => s._id === did)

  if (pickupIndex === -1 || destIndex === -1) {
    return { stops: orderedStops, pickupIdx: -1, destIdx: -1 }
  }

  const start = Math.min(pickupIndex, destIndex)
  const end = Math.max(pickupIndex, destIndex)

  return {
    stops: orderedStops.slice(start, end + 1),
    pickupIdx: pickupIndex < destIndex ? 0 : end - start,
    destIdx: pickupIndex < destIndex ? end - start : 0,
  }
}

function WalkIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="13" cy="4" r="2" />
      <path d="M10 22l1.5-6L9 14l1-5 3 2 3 5-2 1-2-3-1 3 2 1-1 5" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ChevronDownIcon({ open }) {
  return (
    <svg
      className={`h-4 w-4 flex-shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function Results() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    routes = [],
    pickup,
    destination,
    pickupPlace,
    destinationPlace,
    serviceType,
    userLatLng,
  } = location.state || {}

  const [expandedRoute, setExpandedRoute] = useState(null)

  if (!routes.length && !pickup && !destination) {
    return (
      <div className="space-y-6 animate-fade-in">
        <BackLink to="/search" label="Back to search" />
        <EmptyState
          icon={
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          }
          title="No trip data"
          description="Please go back and search for a route first."
          action={
            <button
              onClick={() => navigate('/')}
              className="text-[14px] font-medium text-transit-blue hover:underline"
            >
              Start over
            </button>
          }
        />
      </div>
    )
  }

  const toggleExpand = (routeCode) => {
    setExpandedRoute(expandedRoute === routeCode ? null : routeCode)
  }

  const sortedRoutes = [...routes].sort((a, b) => {
    const totalA = (a.nearestStopDistance ?? Infinity) + (a.destinationStopDistance ?? Infinity)
    const totalB = (b.nearestStopDistance ?? Infinity) + (b.destinationStopDistance ?? Infinity)
    return totalA - totalB
  })

  const bestRoute = sortedRoutes[0] || null

  return (
    <div className="space-y-6 animate-fade-in">
      <BackLink to="/search" label="Back to search" />

      {(pickupPlace || destinationPlace) && (
        <Card>
          {pickupPlace && (
            <CardSection>
              <div className="flex gap-3.5">
                <div className="flex flex-col items-center pt-1">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-ink" />
                  <span className="mt-1 w-px flex-1 bg-line" />
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="text-[12px] uppercase tracking-wider text-muted/70">From</div>
                  <div className="mt-0.5 truncate text-[15px] leading-[20px] text-ink">
                    {pickupPlace.name}
                  </div>
                  {bestRoute?.nearestStop && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-[18px]">
                      <span className="text-muted">Bus stop:</span>
                      <span className="font-medium text-ink">{bestRoute.nearestStop.name}</span>
                      {bestRoute.nearestStopDistance != null && (
                        <span className="inline-flex items-center gap-1 text-transit-blue">
                          <WalkIcon />
                          {formatDistance(bestRoute.nearestStopDistance)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardSection>
          )}
          {destinationPlace && (
            <CardSection bordered={!!pickupPlace}>
              <div className="flex gap-3.5">
                <div className="flex flex-col items-center pt-1">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-transit-blue" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] uppercase tracking-wider text-muted/70">To</div>
                  <div className="mt-0.5 truncate text-[15px] leading-[20px] text-ink">
                    {destinationPlace.name}
                  </div>
                  {bestRoute?.destinationStop && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-[18px]">
                      <span className="text-muted">Bus stop:</span>
                      <span className="font-medium text-ink">{bestRoute.destinationStop.name}</span>
                      {bestRoute.destinationStopDistance != null && (
                        <span className="inline-flex items-center gap-1 text-transit-blue">
                          <WalkIcon />
                          {formatDistance(bestRoute.destinationStopDistance)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardSection>
          )}
        </Card>
      )}

      <div className="space-y-1">
        <h2 className="text-[19px] leading-[25px] font-semibold tracking-tight text-ink">
          {sortedRoutes.length > 0
            ? `${sortedRoutes.length} route${sortedRoutes.length !== 1 ? 's' : ''} found`
            : 'Routes'}
        </h2>
        {sortedRoutes.length > 0 && (
          <p className="text-[14px] leading-[20px] text-muted">
            Sorted by shortest total walk distance
          </p>
        )}
      </div>

      {sortedRoutes.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          title="No routes found"
          description="There are no direct bus routes between these locations. Try different places."
          action={
            <button
              onClick={() => navigate('/search', { state: { serviceType } })}
              className="text-[14px] font-medium text-transit-blue hover:underline"
            >
              Try different locations
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {sortedRoutes.map((route, index) => {
            const isExpanded = expandedRoute === route.code
            const color = ROUTE_COLORS[route.code] || '#1D4E89'
            const isRecommended = index === 0

            const nearestStopCoords = route.nearestStop?.location?.coordinates
            const walkDistance =
              nearestStopCoords
                ? route.nearestStopDistance != null
                  ? route.nearestStopDistance
                  : userLatLng
                    ? haversineDistance(userLatLng, [
                        nearestStopCoords[1],
                        nearestStopCoords[0],
                      ])
                    : null
                : null

            const destStopCoords = route.destinationStop?.location?.coordinates
            const destWalkDistance =
              destStopCoords
                ? route.destinationStopDistance != null
                  ? route.destinationStopDistance
                  : null
                : null

            const mapsLink =
              nearestStopCoords && userLatLng
                ? getGoogleMapsLink(
                    userLatLng[0],
                    userLatLng[1],
                    nearestStopCoords[1],
                    nearestStopCoords[0]
                  )
                : null

            const { stops: segmentStops, pickupIdx, destIdx } = getSegmentStops(
              route.orderedStops,
              route.nearestStop,
              route.destinationStop
            )

            const totalWalk = (walkDistance || 0) + (destWalkDistance || 0)

            return (
              <div
                key={route.code}
                className={`animate-slide-up rounded-2xl border bg-surface transition-shadow duration-200 ${
                  isRecommended
                    ? 'border-transit-blue shadow-md'
                    : 'border-line shadow-sm hover:shadow-md'
                }`}
                style={{ borderLeftColor: color, borderLeftWidth: 4 }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge color={color}>{route.code.replace('pbs-', '')}</Badge>
                      {route.routeType && (
                        <StatusBadge variant="primary">{route.routeType}</StatusBadge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {totalWalk > 0 && (
                        <span className="text-[12px] text-muted">
                          ~{formatDistance(totalWalk)} walk
                        </span>
                      )}
                      {isRecommended && (
                        <StatusBadge variant="primary">Best</StatusBadge>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 text-[14px] leading-[20px] text-muted">
                    {route.displayName}
                  </div>

                  <div className="mt-3.5 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                        {route.nearestStop?.name}
                      </span>
                      <StatusBadge variant="success">Board here</StatusBadge>
                      {walkDistance !== null && (
                        <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-[13px] text-transit-blue">
                          <WalkIcon />
                          {formatDistance(walkDistance)}
                        </span>
                      )}
                    </div>
                    <div className="pl-[3px]">
                      <span className="block h-3 w-px bg-line" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                        {route.destinationStop?.name}
                      </span>
                      <StatusBadge variant="warning">Get off here</StatusBadge>
                      {destWalkDistance !== null && (
                        <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-[13px] text-transit-blue">
                          <WalkIcon />
                          {formatDistance(destWalkDistance)}
                        </span>
                      )}
                    </div>
                  </div>

                  {mapsLink && (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-transit-blue transition-colors hover:underline"
                    >
                      <PinIcon />
                      Walk to {route.nearestStop?.name}
                    </a>
                  )}
                </div>

                <button
                  onClick={() => toggleExpand(route.code)}
                  className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-left text-[13px] font-medium text-muted transition-colors hover:bg-paper"
                >
                  {isExpanded ? 'Hide route stops' : `Show all ${segmentStops.length} stops`}
                  <ChevronDownIcon open={isExpanded} />
                </button>

                {isExpanded && (
                  <div className="animate-slide-down border-t border-line px-4 py-3">
                    <ol className="space-y-0">
                      {segmentStops.map((stop, i) => {
                        const isPickup = i === pickupIdx
                        const isDest = i === destIdx
                        const isEndpoint = isPickup || isDest
                        const isLast = i === segmentStops.length - 1

                        return (
                          <li key={stop._id} className="flex items-start gap-3">
                            <div className="flex flex-col items-center pt-[5px]">
                              <span
                                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                                  isEndpoint ? '' : 'bg-line'
                                }`}
                                style={isEndpoint ? { backgroundColor: color } : undefined}
                              />
                              {!isLast && <span className="mt-0.5 w-px flex-1 bg-line" />}
                            </div>
                            <div className={`min-w-0 flex-1 pb-3 text-[13px] leading-[18px] ${isEndpoint ? 'font-medium text-ink' : 'text-muted'}`}>
                              {stop.name}
                              {isPickup && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                  Board here
                                </span>
                              )}
                              {isDest && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  Get off here
                                </span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Results
