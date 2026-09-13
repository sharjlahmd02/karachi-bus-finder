import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRouteMatch } from '../hooks/useRouteMatch'
import BackLink from '../components/BackLink'
import Button from '../components/Button'
import Card, { CardSection } from '../components/Card'
import Alert from '../components/Alert'
import LocationSearch from '../components/LocationSearch'

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

  const [pickupLocation, setPickupLocation] = useState(null)
  const [destinationLocation, setDestinationLocation] = useState(null)
  const [userLatLng, setUserLatLng] = useState(null)
  const [error, setError] = useState(null)

  const { findRoutesByCoords, loading: routeLoading, error: routeError } = useRouteMatch()

  const handlePickupLocationFound = (loc) => {
    if (loc.name === 'My current location') {
      setUserLatLng({ lat: loc.lat, lng: loc.lng })
    }
  }

  const handleFindRoutes = async () => {
    if (!pickupLocation || !destinationLocation) {
      setError('Please select both pickup and destination locations')
      return
    }

    if (
      pickupLocation.lat === destinationLocation.lat &&
      pickupLocation.lng === destinationLocation.lng
    ) {
      setError('Pickup and destination must be different locations')
      return
    }

    setError(null)
    const data = await findRoutesByCoords(
      pickupLocation.lat,
      pickupLocation.lng,
      destinationLocation.lat,
      destinationLocation.lng,
      serviceType
    )

    if (data && data.routes) {
      navigate('/results', {
        state: {
          routes: data.routes,
          pickup: data.pickupStop,
          destination: data.destinationStop,
          pickupPlace: pickupLocation,
          destinationPlace: destinationLocation,
          serviceType,
          userLatLng: userLatLng
            ? [userLatLng.lat, userLatLng.lng]
            : [pickupLocation.lat, pickupLocation.lng],
        },
        replace: true,
      })
    } else if (!routeError) {
      setError('No routes found between these locations. Try different places.')
    }
  }

  const hasBoth = pickupLocation && destinationLocation

  return (
    <div className="space-y-5 animate-fade-in">
      <BackLink to="/" label="Public Bus Service" />

      <div className="space-y-1">
        <h1 className="text-[22px] leading-[28px] font-semibold tracking-tight text-ink">
          Plan your trip
        </h1>
        <p className="text-[14px] leading-[20px] text-muted">
          Enter where you are and where you're going. We'll find the nearest bus stops for you.
        </p>
      </div>

      <Card>
        <CardSection>
          <LocationSearch
            label="From"
            placeholder="Where are you starting from?"
            value={pickupLocation}
            onChange={setPickupLocation}
            onLocationFound={handlePickupLocationFound}
            userLatLng={userLatLng}
          />
        </CardSection>

        <CardSection bordered>
          <LocationSearch
            label="To"
            placeholder="Where are you going?"
            value={destinationLocation}
            onChange={setDestinationLocation}
            userLatLng={userLatLng}
          />
        </CardSection>
      </Card>

      {error && <Alert type="error">{error}</Alert>}
      {routeError && <Alert type="error">{routeError}</Alert>}

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
