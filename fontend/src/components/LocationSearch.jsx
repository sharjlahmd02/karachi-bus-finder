import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import debounce from '../utils/debounce'
import Spinner from './Spinner'

const PHOTON_API = 'https://photon.komoot.io/api/'

function LocationSearch({
  label,
  placeholder = 'Search for a place...',
  value,
  onChange,
  onLocationFound,
  userLatLng,
  icon,
}) {
  const [query, setQuery] = useState(value?.name || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const userLatLngRef = useRef(userLatLng)

  userLatLngRef.current = userLatLng

  useEffect(() => {
    setQuery(value?.name || '')
  }, [value])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let url = `${PHOTON_API}?q=${encodeURIComponent(q)}&limit=6&lang=en`
      const ll = userLatLngRef.current
      if (ll) {
        url += `&lat=${ll.lat}&lon=${ll.lng}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setResults(data.features || [])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const searchPlaces = useMemo(() => debounce(doSearch, 250), [doSearch])

  const handleInputChange = (e) => {
    const v = e.target.value
    setQuery(v)
    setShowDropdown(true)
    setLoading(true)
    searchPlaces(v)
  }

  const handleSelect = (feature) => {
    const [lng, lat] = feature.geometry.coordinates
    const props = feature.properties
    const name = [props.name, props.city || props.district, 'Karachi'].filter(Boolean).join(', ')

    setQuery(name)
    setShowDropdown(false)
    setResults([])

    const location = { name, lat, lng }
    onChange(location)
    if (onLocationFound) onLocationFound(location)
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude

        try {
          const res = await fetch(
            `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`
          )
          let name = 'My current location'
          if (res.ok) {
            const data = await res.json()
            const props = data.features?.[0]?.properties
            if (props) {
              name = [props.name, props.city || props.district, 'Karachi']
                .filter(Boolean)
                .join(', ')
            }
          }
          setQuery(name)
          setShowDropdown(false)
          const location = { name, lat, lng }
          onChange(location)
          if (onLocationFound) onLocationFound(location)
        } catch {
          setQuery('My current location')
          setShowDropdown(false)
          const location = { name: 'My current location', lat, lng }
          onChange(location)
          if (onLocationFound) onLocationFound(location)
        } finally {
          setGeoLoading(false)
        }
      },
      () => {
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    onChange(null)
  }

  const isLoaded = !!value

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="text-[14px] font-semibold text-ink">{label}</label>
        <button
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-transit-blue transition-colors hover:bg-transit-blue/5 disabled:opacity-50"
        >
          {geoLoading ? (
            <Spinner size="sm" />
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          )}
          {geoLoading ? 'Locating...' : 'My location'}
        </button>
      </div>

      {isLoaded ? (
        <div className="flex items-center justify-between rounded-lg bg-transit-blue/5 px-3.5 py-3 ring-4 ring-transit-blue/10">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <svg className="h-4 w-4 flex-shrink-0 text-transit-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
              {value.name}
            </span>
          </div>
          <button
            onClick={handleClear}
            className="ml-2 flex-shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium text-transit-blue transition-colors hover:bg-transit-blue/10"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            {icon && (
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                {icon}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => query && results.length > 0 && setShowDropdown(true)}
              placeholder={placeholder}
              className={`w-full rounded-lg border border-line bg-paper py-3 text-[14px] text-ink outline-none transition-all placeholder:text-muted/60 focus:border-transit-blue focus:bg-surface focus:ring-4 focus:ring-transit-blue/10 ${
                icon ? 'pl-10 pr-3.5' : 'px-3.5'
              }`}
            />
            {loading && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <Spinner size="sm" className="text-muted" />
              </div>
            )}
          </div>

          {showDropdown && query.length >= 2 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-2 max-h-[240px] overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
              {results.length > 0 ? (
                results.map((feature, i) => {
                  const props = feature.properties
                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(feature)}
                      className="flex w-full items-start gap-2.5 border-b border-line px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-paper"
                    >
                      <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink">{props.name}</div>
                        <div className="text-[11px] text-muted">
                          {[props.district, props.city, props.state].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    </button>
                  )
                })
              ) : (
                !loading && (
                  <div className="px-3.5 py-4 text-center text-[13px] text-muted">
                    No places found
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LocationSearch
