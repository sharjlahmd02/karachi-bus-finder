const API_BASE = '/api'

class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }

  const res = await fetch(url, config)
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed with status ${res.status}`,
      res.status,
      data
    )
  }

  return data
}

export function searchStops(query, serviceType, limit = 10) {
  const params = new URLSearchParams({
    q: query,
    serviceType,
    limit: String(limit),
  })
  return request(`/stops/search?${params}`)
}

export function findNearestStop(lat, lng, serviceType, options = {}) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    serviceType,
  })
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.maxDistanceMeters != null) params.set('maxDistanceMeters', String(options.maxDistanceMeters))
  return request(`/stops/nearest?${params}`)
}

export function matchRoutes(pickupStopId, destinationStopId, serviceType) {
  return request('/routes/match', {
    method: 'POST',
    body: JSON.stringify({ pickupStopId, destinationStopId, serviceType }),
  })
}

export function matchRoutesByCoords(pickupLat, pickupLng, destinationLat, destinationLng, serviceType) {
  return request('/routes/match-by-coords', {
    method: 'POST',
    body: JSON.stringify({ pickupLat, pickupLng, destinationLat, destinationLng, serviceType }),
  })
}

export function checkHealth() {
  return request('/health')
}

export { ApiError }
