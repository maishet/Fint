import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getStoredSensitiveAmountsVisible, storeSensitiveAmountsVisible } from './sensitiveAmountsStorage'

type SensitiveAmountsContextValue = {
  isHydrated: boolean
  amountsVisible: boolean
  setAmountsVisible: (visible: boolean) => void
  toggleAmountsVisibility: () => void
}

const SensitiveAmountsContext = createContext<SensitiveAmountsContextValue | null>(null)

export function SensitiveAmountsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [isHydrated, setIsHydrated] = useState(false)
  const [amountsVisible, setAmountsVisibleState] = useState(true)

  useEffect(() => {
    let active = true
    setIsHydrated(false)
    if (!userId) {
      setAmountsVisibleState(true)
      setIsHydrated(true)
      return () => { active = false }
    }
    getStoredSensitiveAmountsVisible(userId)
      .then((stored) => {
        if (!active) return
        setAmountsVisibleState(stored ?? true)
        setIsHydrated(true)
      })
      .catch(() => {
        if (!active) return
        setAmountsVisibleState(true)
        setIsHydrated(true)
      })
    return () => { active = false }
  }, [userId])

  const setAmountsVisible = (visible: boolean) => {
    setAmountsVisibleState(visible)
    if (userId) storeSensitiveAmountsVisible(userId, visible).catch(() => undefined)
  }

  const value = useMemo(() => ({
    isHydrated,
    amountsVisible,
    setAmountsVisible,
    toggleAmountsVisibility: () => setAmountsVisible(!amountsVisible),
  }), [amountsVisible, isHydrated, userId])

  return <SensitiveAmountsContext.Provider value={value}>{children}</SensitiveAmountsContext.Provider>
}

export function useSensitiveAmounts() {
  const value = useContext(SensitiveAmountsContext)
  if (!value) throw new Error('useSensitiveAmounts must be used within SensitiveAmountsProvider')
  return value
}
