import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { searchStops, findNearestStop } from '../services/api'
import debounce from '../utils/debounce'

export function useStopSearch(serviceType) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const abortRef = useRef(null)
  const serviceTypeRef = useRef(serviceType)

  useEffect(() => {
    serviceTypeRef.current = serviceType
  })

  const doSearch = useCallback(async (q) => {
    if (abortRef.current) abortRef.current.abort()

    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const data = await searchStops(q.trim(), serviceTypeRef.current, 10)
      if (!controller.signal.aborted) {
        setResults(data)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Search failed')
        setResults([])
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  const searchFn = useMemo(() => debounce(doSearch, 250), [doSearch])

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const handleQueryChange = useCallback((value) => {
    setQuery(value)
    setSelected(null)
    setError(null)
    setLoading(true)
    searchFn(value)
  }, [searchFn])

  const handleSelect = useCallback((stop) => {
    setSelected(stop)
    setQuery(stop.name)
    setResults([])
  }, [])

  const handleClear = useCallback(() => {
    setQuery('')
    setSelected(null)
    setResults([])
    setError(null)
  }, [])

  return {
    query,
    results,
    loading,
    error,
    selected,
    setQuery: handleQueryChange,
    select: handleSelect,
    clear: handleClear,
  }
}

export function useNearbyStops(serviceType) {
  const [stops, setStops] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)

  const fetchNearby = useCallback(async (lat, lng, limit = 5) => {
    setLoading(true)
    setError(null)
    try {
      const data = await findNearestStop(lat, lng, serviceType, { limit })
      setStops(Array.isArray(data) ? data : [data])
    } catch (err) {
      setError(err.message || 'Failed to find nearby stops')
      setStops([])
    } finally {
      setLoading(false)
    }
  }, [serviceType])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setUserLocation({ lat, lng })
        await fetchNearby(lat, lng)
      },
      (err) => {
        setLoading(false)
        if (err.code === 1) {
          setError('Location access denied. Please enable location permissions.')
        } else if (err.code === 2) {
          setError('Unable to determine your location.')
        } else {
          setError('Location request timed out. Please try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [fetchNearby])

  return { stops, loading, error, userLocation, fetchNearby, requestLocation }
}
