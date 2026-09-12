import { useState, useCallback } from 'react'
import { matchRoutesByCoords, matchRoutes, ApiError } from '../services/api'

export function useRouteMatch() {
  const [routes, setRoutes] = useState([])
  const [pickupStop, setPickupStop] = useState(null)
  const [destinationStop, setDestinationStop] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const findRoutesByCoords = useCallback(async (pickupLat, pickupLng, destLat, destLng, serviceType) => {
    setLoading(true)
    setError(null)
    setRoutes([])
    try {
      const data = await matchRoutesByCoords(pickupLat, pickupLng, destLat, destLng, serviceType)
      setRoutes(data.routes || [])
      setPickupStop(data.pickupStop || null)
      setDestinationStop(data.destinationStop || null)
      return data
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setRoutes([])
        setError(null)
        return null
      }
      setError(err.message || 'Failed to find routes')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const findRoutesByStops = useCallback(async (pickupStopId, destinationStopId, serviceType) => {
    setLoading(true)
    setError(null)
    setRoutes([])
    try {
      const data = await matchRoutes(pickupStopId, destinationStopId, serviceType)
      setRoutes(Array.isArray(data) ? data : [])
      return data
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setRoutes([])
        setError(null)
        return null
      }
      setError(err.message || 'Failed to find routes')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setRoutes([])
    setPickupStop(null)
    setDestinationStop(null)
    setError(null)
  }, [])

  return {
    routes,
    pickupStop,
    destinationStop,
    loading,
    error,
    findRoutesByCoords,
    findRoutesByStops,
    reset,
  }
}
