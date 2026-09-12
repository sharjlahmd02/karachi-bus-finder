const KARACHI_BOUNDS = {
  minLat: 24.70,
  maxLat: 25.15,
  minLng: 66.60,
  maxLng: 67.60,
}

export function validateServiceType(type) {
  if (!type || (type !== 'pbs' && type !== 'local')) {
    return 'Invalid service type'
  }
  return null
}

export function validateCoordinates(lat, lng, label = 'Coordinates') {
  if (lat == null || lng == null) {
    return `${label} are required`
  }
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return `${label} must be valid numbers`
  }
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return `${label} are out of valid range`
  }
  if (
    latNum < KARACHI_BOUNDS.minLat || latNum > KARACHI_BOUNDS.maxLat ||
    lngNum < KARACHI_BOUNDS.minLng || lngNum > KARACHI_BOUNDS.maxLng
  ) {
    return `${label} must be within Karachi`
  }
  return null
}

export function validateStopSelection(place, fieldName) {
  if (!place) {
    return `Please select a ${fieldName}`
  }
  if (!place.name) {
    return `Invalid ${fieldName} selection`
  }
  return null
}

export function validateSearchQuery(query) {
  if (!query || !query.trim()) {
    return 'Search query is required'
  }
  if (query.trim().length > 100) {
    return 'Search query must be 100 characters or less'
  }
  return null
}

function getStopCoords(stop) {
  if (!stop) return null
  if (stop.lat != null && stop.lng != null) {
    return { lat: Number(stop.lat), lng: Number(stop.lng) }
  }
  if (stop.location?.coordinates) {
    return { lat: stop.location.coordinates[1], lng: stop.location.coordinates[0] }
  }
  return null
}

export function validateMatchByCoordsForm(pickup, destination, serviceType) {
  const errors = {}

  const serviceError = validateServiceType(serviceType)
  if (serviceError) errors.serviceType = serviceError

  const pickupError = validateStopSelection(pickup, 'pickup location')
  if (pickupError) errors.pickup = pickupError

  const destError = validateStopSelection(destination, 'destination')
  if (destError) errors.destination = destError

  if (!pickupError && !destError) {
    const pCoords = getStopCoords(pickup)
    const dCoords = getStopCoords(destination)
    if (pCoords && dCoords && pCoords.lat === dCoords.lat && pCoords.lng === dCoords.lng) {
      errors.destination = 'Pickup and destination must be different'
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}
