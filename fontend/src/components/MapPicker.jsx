import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { findNearestStop, searchStops } from '../services/api'
import Spinner from './Spinner'
import 'leaflet/dist/leaflet.css'

const KARACHI_CENTER = [24.8607, 67.0011]
const DEFAULT_ZOOM = 13

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#1D4E89;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const stopIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#E91E63;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const selectedStopIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#4CAF50;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;background:#1D4E89;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
    <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function MapEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, Math.max(map.getZoom(), 14), { animate: true })
    }
  }, [center, map])
  return null
}

function formatDistance(meters) {
  if (meters == null) return ''
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function MapPicker({ label, serviceType, onSelect, selectedStop, userLocation, onUserLocationDetected }) {
  const [nearbyStops, setNearbyStops] = useState([])
  const [loadingStops, setLoadingStops] = useState(false)
  const [mapCenter, setMapCenter] = useState(KARACHI_CENTER)
  const [pickedLocation, setPickedLocation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const mapRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng])
    }
  }, [userLocation])

  const fetchNearbyStops = useCallback(async (lat, lng) => {
    setLoadingStops(true)
    try {
      const stops = await findNearestStop(lat, lng, serviceType, { limit: 20, maxDistanceMeters: 3000 })
      setNearbyStops(Array.isArray(stops) ? stops : stops ? [stops] : [])
    } catch {
      setNearbyStops([])
    } finally {
      setLoadingStops(false)
    }
  }, [serviceType])

  const handleMapClick = useCallback((lat, lng) => {
    setPickedLocation({ lat, lng })
    fetchNearbyStops(lat, lng)
  }, [fetchNearbyStops])

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const loc = { lat, lng }
        setMapCenter([lat, lng])
        setPickedLocation(loc)
        if (onUserLocationDetected) onUserLocationDetected(loc)
        fetchNearbyStops(lat, lng)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSearch = (value) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!value.trim()) {
      setSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const stops = await searchStops(value.trim(), serviceType, 8)
        setSearchResults(stops)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const handleSelectSearchResult = (stop) => {
    const lat = stop.location.coordinates[1]
    const lng = stop.location.coordinates[0]
    setMapCenter([lat, lng])
    setPickedLocation({ lat, lng })
    setSearchQuery(stop.name)
    setSearchResults([])
    onSelect({
      _id: stop._id,
      name: stop.name,
      lat,
      lng,
      location: stop.location,
    })
  }

  const handleSelectNearbyStop = (stop) => {
    const lat = stop.location.coordinates[1]
    const lng = stop.location.coordinates[0]
    setPickedLocation({ lat, lng })
    onSelect({
      _id: stop._id,
      name: stop.name,
      lat,
      lng,
      location: stop.location,
      distance: stop.distance,
    })
  }

  const selectedStopId = selectedStop?._id

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[14px] font-semibold text-ink">{label}</label>
        <button
          onClick={handleUseMyLocation}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-transit-blue transition-colors hover:bg-transit-blue/5"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          My location
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search for a bus stop..."
          className="w-full rounded-lg border border-line bg-paper py-2.5 pl-10 pr-3.5 text-[14px] text-ink outline-none transition-all placeholder:text-muted/60 focus:border-transit-blue focus:bg-surface focus:ring-4 focus:ring-transit-blue/10"
        />
        <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        {searching && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <Spinner size="sm" className="text-muted" />
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="max-h-[160px] overflow-y-auto rounded-lg border border-line bg-surface shadow-md">
          {searchResults.map((stop) => (
            <button
              key={stop._id}
              onClick={() => handleSelectSearchResult(stop)}
              className="flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-paper"
            >
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span className="text-[13px] text-ink">{stop.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line" style={{ height: '280px' }}>
        <MapContainer
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents onMapClick={handleMapClick} />
          <RecenterMap center={mapCenter} />

          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup><span className="text-[12px] font-medium">Your location</span></Popup>
            </Marker>
          )}

          {pickedLocation && (
            <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pinIcon}>
              <Popup><span className="text-[12px] font-medium">Picked location</span></Popup>
            </Marker>
          )}

          {nearbyStops.map((stop) => {
            const lat = stop.location.coordinates[1]
            const lng = stop.location.coordinates[0]
            const isSelected = stop._id === selectedStopId
            return (
              <Marker
                key={stop._id}
                position={[lat, lng]}
                icon={isSelected ? selectedStopIcon : stopIcon}
                eventHandlers={{
                  click: () => handleSelectNearbyStop(stop),
                }}
              >
                <Popup>
                  <div className="text-[12px]">
                    <div className="font-semibold">{stop.name}</div>
                    {stop.distance != null && (
                      <div className="text-muted">{formatDistance(stop.distance)} away</div>
                    )}
                    <button
                      onClick={() => handleSelectNearbyStop(stop)}
                      className="mt-1 text-[11px] font-medium text-blue-600 hover:underline"
                    >
                      Select this stop
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {loadingStops && (
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <Spinner size="sm" />
          Finding nearby stops...
        </div>
      )}

      {selectedStop && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5">
          <svg className="h-4 w-4 flex-shrink-0 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-green-800">{selectedStop.name}</div>
            {selectedStop.distance != null && (
              <div className="text-[11px] text-green-600">{formatDistance(selectedStop.distance)} from picked point</div>
            )}
          </div>
        </div>
      )}

      {!selectedStop && nearbyStops.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium text-muted">
            Tap a stop on the map or pick from nearby:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nearbyStops.slice(0, 6).map((stop) => (
              <button
                key={stop._id}
                onClick={() => handleSelectNearbyStop(stop)}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-transit-blue hover:text-transit-blue"
              >
                {stop.name}
                {stop.distance != null && (
                  <span className="ml-1 text-muted">{formatDistance(stop.distance)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MapPicker
