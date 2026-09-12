import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRouteMatch } from '../hooks/useRouteMatch'
import { validateMatchByCoordsForm } from '../utils/validation'
import BackLink from '../components/BackLink'
import Button from '../components/Button'
import Alert from '../components/Alert'
import MapPicker from '../components/MapPicker'

function SearchIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function Search() {
  const navigate = useNavigate()
  const location = useLocation()
  const serviceType = location.state?.serviceType || 'pbs'

  const [pickupStop, setPickupStop] = useState(null)
  const [destinationStop, setDestinationStop] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const { findRoutesByCoords, loading: routeLoading, error: routeError } = useRouteMatch()

  const handleFindRoutes = async () => {
    const errors = validateMatchByCoordsForm(
      pickupStop,
      destinationStop,
      serviceType
    )

    if (errors) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    const data = await findRoutesByCoords(
      pickupStop.lat,
      pickupStop.lng,
      destinationStop.lat,
      destinationStop.lng,
      serviceType
    )

    if (data && data.routes) {
      navigate('/results', {
        state: {
          routes: data.routes,
          pickup: data.pickupStop,
          destination: data.destinationStop,
          pickupPlace: pickupStop,
          destinationPlace: destinationStop,
          serviceType,
          userLatLng: userLocation
            ? [userLocation.lat, userLocation.lng]
            : [pickupStop.lat, pickupStop.lng],
        },
        replace: true,
      })
    }
  }

  const hasBoth = pickupStop && destinationStop

  return (
    <div className="space-y-5 animate-fade-in">
      <BackLink to="/" label="Public Bus Service" />

      <div className="space-y-1">
        <h1 className="text-[22px] leading-[28px] font-semibold tracking-tight text-ink">
          Plan your trip
        </h1>
        <p className="text-[14px] leading-[20px] text-muted">
          Pick your starting point and destination on the map, then select the nearest bus stop.
        </p>
      </div>

      <div className="space-y-4">
        <MapPicker
          label="From"
          serviceType={serviceType}
          onSelect={setPickupStop}
          selectedStop={pickupStop}
          userLocation={userLocation}
          onUserLocationDetected={setUserLocation}
        />

        <MapPicker
          label="To"
          serviceType={serviceType}
          onSelect={setDestinationStop}
          selectedStop={destinationStop}
          userLocation={userLocation}
        />
      </div>

      {(formErrors.pickup || formErrors.destination) && (
        <Alert type="error">
          {formErrors.pickup || formErrors.destination}
        </Alert>
      )}

      {routeError && (
        <Alert type="error">{routeError}</Alert>
      )}

      {formErrors.serviceType && (
        <Alert type="error">{formErrors.serviceType}</Alert>
      )}

      <Button
        onClick={handleFindRoutes}
        disabled={!hasBoth || routeLoading}
        loading={routeLoading}
        size="lg"
        className="w-full"
      >
        {!routeLoading && <SearchIcon />}
        {routeLoading ? 'Finding routes...' : 'Find Routes'}
      </Button>
    </div>
  )
}

export default Search
