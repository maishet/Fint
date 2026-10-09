import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { cancelDailyReminder, isDailyReminderSchedulable, REMINDER_HOUR, REMINDER_MINUTE, scheduleDailyReminder } from './dailyReminders'
import {
  getStoredDailyReminderTime,
  getStoredDailyRemindersEnabled,
  storeDailyReminderTime,
  storeDailyRemindersEnabled,
} from './dailyRemindersStorage'

type DailyRemindersContextValue = {
  isHydrated: boolean
  enabled: boolean
  hour: number
  minute: number
  /** Resuelve `false` si no se pudo programar el recordatorio (queda apagado). */
  setEnabled: (enabled: boolean) => Promise<boolean>
  toggle: () => void
  /** Resuelve `false` si el recordatorio estaba activo y no se pudo reprogramar (queda apagado). */
  setReminderTime: (hour: number, minute: number) => Promise<boolean>
}

const DailyRemindersContext = createContext<DailyRemindersContextValue | null>(null)

export function DailyRemindersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [isHydrated, setIsHydrated] = useState(false)
  const [enabled, setEnabledState] = useState(false)
  const [hour, setHourState] = useState(() => new Date().getHours())
  const [minute, setMinuteState] = useState(() => new Date().getMinutes())
  const hasStoredTime = useRef(false)

  useEffect(() => {
    let active = true
    setIsHydrated(false)
    if (!userId) {
      setEnabledState(false)
      hasStoredTime.current = false
      setIsHydrated(true)
      return () => { active = false }
    }
    Promise.all([getStoredDailyRemindersEnabled(userId), getStoredDailyReminderTime(userId)])
      .then(async ([storedEnabled, storedTime]) => {
        if (!active) return
        const wanted = storedEnabled ?? false
        hasStoredTime.current = storedTime != null
        let time = storedTime
        if (!time && wanted) {
          time = { hour: REMINDER_HOUR, minute: REMINDER_MINUTE }
          hasStoredTime.current = true
          if (userId) storeDailyReminderTime(userId, time.hour, time.minute).catch(() => undefined)
        }
        const display = time ?? { hour: new Date().getHours(), minute: new Date().getMinutes() }
        setHourState(display.hour)
        setMinuteState(display.minute)
        const scheduled =
          wanted &&
          (await isDailyReminderSchedulable()) &&
          (await scheduleDailyReminder(display.hour, display.minute).catch(() => false))
        if (wanted && !scheduled) await storeDailyRemindersEnabled(userId, false).catch(() => undefined)
        if (!active) return
        setEnabledState(scheduled)
        setIsHydrated(true)
      })
      .catch(() => {
        if (!active) return
        setEnabledState(false)
        setIsHydrated(true)
      })
    return () => { active = false }
  }, [userId])

  const setEnabled = async (next: boolean): Promise<boolean> => {
    setEnabledState(next)
    if (userId) storeDailyRemindersEnabled(userId, next).catch(() => undefined)
    if (!next) {
      cancelDailyReminder().catch(() => undefined)
      return true
    }
    let nextHour = hour
    let nextMinute = minute
    if (!hasStoredTime.current) {
      const now = new Date()
      nextHour = now.getHours()
      nextMinute = now.getMinutes()
      setHourState(nextHour)
      setMinuteState(nextMinute)
      hasStoredTime.current = true
      if (userId) storeDailyReminderTime(userId, nextHour, nextMinute).catch(() => undefined)
    }
    const scheduled = await scheduleDailyReminder(nextHour, nextMinute).catch(() => false)
    if (!scheduled) {
      setEnabledState(false)
      if (userId) storeDailyRemindersEnabled(userId, false).catch(() => undefined)
    }
    return scheduled
  }

  const setReminderTime = async (nextHour: number, nextMinute: number): Promise<boolean> => {
    setHourState(nextHour)
    setMinuteState(nextMinute)
    hasStoredTime.current = true
    if (userId) storeDailyReminderTime(userId, nextHour, nextMinute).catch(() => undefined)
    if (!enabled) return true
    const scheduled = await scheduleDailyReminder(nextHour, nextMinute).catch(() => false)
    if (!scheduled) {
      setEnabledState(false)
      if (userId) storeDailyRemindersEnabled(userId, false).catch(() => undefined)
    }
    return scheduled
  }

  const value = useMemo(() => ({
    isHydrated,
    enabled,
    hour,
    minute,
    setEnabled,
    toggle: () => { void setEnabled(!enabled) },
    setReminderTime,
  }), [enabled, hour, minute, isHydrated, userId])

  return <DailyRemindersContext.Provider value={value}>{children}</DailyRemindersContext.Provider>
}

export function useDailyReminders() {
  const value = useContext(DailyRemindersContext)
  if (!value) throw new Error('useDailyReminders must be used within DailyRemindersProvider')
  return value
}
