import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { cancelDailyReminder, isDailyReminderSchedulable, scheduleDailyReminder } from './dailyReminders'
import { getStoredDailyRemindersEnabled, storeDailyRemindersEnabled } from './dailyRemindersStorage'

type DailyRemindersContextValue = {
  isHydrated: boolean
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  toggle: () => void
}

const DailyRemindersContext = createContext<DailyRemindersContextValue | null>(null)

export function DailyRemindersProvider({ children }: { children: React.ReactNode }) {
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
    getStoredDailyRemindersEnabled(userId)
      .then(async (stored) => {
        if (!active) return
        const wanted = stored ?? false
        // Reconcile with the OS: only stay enabled if reminders can still be scheduled.
        if (wanted && (await isDailyReminderSchedulable())) {
          await scheduleDailyReminder().catch(() => undefined)
          if (!active) return
          setEnabledState(true)
        } else {
          if (wanted) await storeDailyRemindersEnabled(userId, false).catch(() => undefined)
          if (!active) return
          setEnabledState(false)
        }
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
    if (userId) storeDailyRemindersEnabled(userId, next).catch(() => undefined)
    if (next) {
      scheduleDailyReminder()
        .then((scheduled) => {
          if (!scheduled) {
            setEnabledState(false)
            if (userId) storeDailyRemindersEnabled(userId, false).catch(() => undefined)
          }
        })
        .catch(() => {
          setEnabledState(false)
          if (userId) storeDailyRemindersEnabled(userId, false).catch(() => undefined)
        })
    } else {
      cancelDailyReminder().catch(() => undefined)
    }
  }

  const value = useMemo(() => ({
    isHydrated,
    enabled,
    setEnabled,
    toggle: () => setEnabled(!enabled),
  }), [enabled, isHydrated, userId])

  return <DailyRemindersContext.Provider value={value}>{children}</DailyRemindersContext.Provider>
}

export function useDailyReminders() {
  const value = useContext(DailyRemindersContext)
  if (!value) throw new Error('useDailyReminders must be used within DailyRemindersProvider')
  return value
}
