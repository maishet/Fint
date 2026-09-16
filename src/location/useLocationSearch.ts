import { useEffect, useRef, useState } from 'react'
import { createPlacesSession, resolveSuggestion, searchLocation, searchLocationSuggestions, type CapturedLocation, type LocationSuggestion } from './captureLocation'

const SUGGESTION_DEBOUNCE_MS = 450

export function suggestionKey(suggestion: LocationSuggestion): string {
  return suggestion.placeId ?? suggestion.primaryText
}

export function useLocationSearch(active: boolean) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [resolvingKey, setResolvingKey] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTokenRef = useRef(createPlacesSession())

  useEffect(() => {
    if (!active) return
    sessionTokenRef.current = createPlacesSession()
  }, [active])

  useEffect(() => {
    if (!active) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      setIsSuggesting(false)
      return
    }
    setIsSuggesting(true)
    debounceRef.current = setTimeout(() => {
      void searchLocationSuggestions(trimmed, sessionTokenRef.current).then((results) => {
        setSuggestions(results)
        setIsSuggesting(false)
      })
    }, SUGGESTION_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, active])

  const reset = () => {
    setQuery('')
    setSuggestions([])
    setSearchFailed(false)
  }

  const select = async (suggestion: LocationSuggestion): Promise<CapturedLocation | null> => {
    setResolvingKey(suggestionKey(suggestion))
    const resolved = await resolveSuggestion(suggestion, sessionTokenRef.current)
    setResolvingKey(null)
    if (resolved) {
      reset()
      sessionTokenRef.current = createPlacesSession()
    }
    return resolved
  }

  /** Enter/botón de buscar: usa el primer resultado directo, sin pasar por la lista de sugerencias. */
  const submit = async (): Promise<CapturedLocation | null> => {
    const trimmed = query.trim()
    if (!trimmed || isSearching) return null
    setIsSearching(true)
    setSearchFailed(false)
    const result = await searchLocation(trimmed)
    setIsSearching(false)
    if (result) reset()
    else setSearchFailed(true)
    setSuggestions([])
    return result
  }

  return { query, setQuery, suggestions, isSuggesting, isSearching, searchFailed, setSearchFailed, resolvingKey, select, submit, reset }
}
