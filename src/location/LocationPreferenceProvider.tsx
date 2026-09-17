import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getStoredLocationCaptureEnabled, storeLocationCaptureEnabled } from './locationPreferenceStorage'

type LocationPreferenceContextValue = {
  isHydrated: boolean
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

const LocationPreferenceContext = createContext<LocationPreferenceContextValue | null>(null)

export function LocationPreferenceProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [isHydrated, setIsHydrated] = useState(false)
  const [enabled, setEnabledState] = useState(false)

  useEffect(() => {
    let active = true
    setIsHydrated(false)
    if (!userId) {
      setEnabledState(false)
      setIsHydrated(true)
      return () => { active = false }
    }
    getStoredLocationCaptureEnabled(userId)
      .then((stored) => {
        if (!active) return
        setEnabledState(stored ?? false)
        setIsHydrated(true)
      })
      .catch(() => {
        if (!active) return
        setEnabledState(false)
        setIsHydrated(true)
      })
    return () => { active = false }
  }, [userId])

  const setEnabled = (next: boolean) => {
    setEnabledState(next)
    if (userId) storeLocationCaptureEnabled(userId, next).catch(() => undefined)
  }

  const value = useMemo(() => ({ isHydrated, enabled, setEnabled }), [isHydrated, enabled, userId])

  return <LocationPreferenceContext.Provider value={value}>{children}</LocationPreferenceContext.Provider>
}

export function useLocationPreference() {
  const value = useContext(LocationPreferenceContext)
  if (!value) throw new Error('useLocationPreference must be used within LocationPreferenceProvider')
  return value
}
