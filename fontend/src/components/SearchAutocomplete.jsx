import { useState, useRef, useEffect } from 'react'
import Spinner from './Spinner'

function SearchAutocomplete({
  label,
  query,
  results,
  loading,
  selected,
  onQueryChange,
  onSelect,
  onClear,
  placeholder = 'Search for a bus stop...',
  icon,
  emptyMessage = 'No stops found',
  error,
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFocus = () => {
    if (query && !selected) {
      setShowDropdown(true)
    }
  }

  const handleInputChange = (e) => {
    onQueryChange(e.target.value)
    setShowDropdown(true)
  }

  const handleSelect = (stop) => {
    onSelect(stop)
    setShowDropdown(false)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    onClear()
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="block text-[13px] font-medium leading-[18px] text-muted">
          {label}
        </label>
      )}

      {selected ? (
        <div className="flex items-center justify-between rounded-lg bg-transit-blue/5 px-3.5 py-3 ring-4 ring-transit-blue/10">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <svg className="h-4 w-4 flex-shrink-0 text-transit-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
              {selected.name}
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
              onFocus={handleFocus}
              placeholder={placeholder}
              className={`w-full rounded-lg border bg-paper py-3 text-[15px] text-ink outline-none transition-all placeholder:text-muted/60 focus:border-transit-blue focus:bg-surface focus:ring-4 focus:ring-transit-blue/10 ${
                error ? 'border-red-400' : 'border-line'
              } ${icon ? 'pl-10 pr-3.5' : 'px-3.5'}`}
            />
            {loading && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <Spinner size="sm" className="text-muted" />
              </div>
            )}
          </div>

          {showDropdown && query && !selected && (
            <div className="absolute top-full left-0 right-0 z-20 mt-2 max-h-[260px] overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
              {results.length > 0 ? (
                results.map((stop) => (
                  <button
                    key={stop._id}
                    onClick={() => handleSelect(stop)}
                    className="flex w-full items-center gap-3 border-b border-line px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-paper"
                  >
                    <svg className="h-4 w-4 flex-shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-ink">{stop.name}</div>
                      {stop.matchScore != null && (
                        <div className="text-[12px] text-muted">
                          {stop.matchScore < 0.1 ? 'Exact match' : 'Close match'}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                !loading && (
                  <div className="px-3.5 py-4 text-center text-[13px] text-muted">
                    {emptyMessage}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-[12px] leading-[16px] text-red-600">{error}</p>
      )}
    </div>
  )
}

export default SearchAutocomplete
