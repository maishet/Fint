import * as SecureStore from 'expo-secure-store'

const enabledKeyPrefix = 'fint-daily-reminders-enabled'
const timeKeyPrefix = 'fint-daily-reminders-time'

function enabledKey(userId: string) {
  return `${enabledKeyPrefix}-${userId}`
}

function timeKey(userId: string) {
  return `${timeKeyPrefix}-${userId}`
}

export async function getStoredDailyRemindersEnabled(userId: string) {
  const value = await SecureStore.getItemAsync(enabledKey(userId))
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export async function storeDailyRemindersEnabled(userId: string, enabled: boolean) {
  await SecureStore.setItemAsync(enabledKey(userId), enabled ? 'true' : 'false')
}

export type DailyReminderTime = { hour: number; minute: number }

export async function getStoredDailyReminderTime(userId: string): Promise<DailyReminderTime | null> {
  const value = await SecureStore.getItemAsync(timeKey(userId))
  if (!value) return null
  const [rawHour, rawMinute] = value.split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  return { hour, minute }
}

export async function storeDailyReminderTime(userId: string, hour: number, minute: number) {
  await SecureStore.setItemAsync(timeKey(userId), `${hour}:${minute}`)
}
