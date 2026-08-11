import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const keyPrefix = 'fint-daily-reminders-enabled'

function storageKey(userId: string) {
  return `${keyPrefix}-${userId}`
}

export async function getStoredDailyRemindersEnabled(userId: string) {
  const value = Platform.OS === 'web' ? window.localStorage.getItem(storageKey(userId)) : await SecureStore.getItemAsync(storageKey(userId))
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export async function storeDailyRemindersEnabled(userId: string, enabled: boolean) {
  const value = enabled ? 'true' : 'false'
  if (Platform.OS === 'web') {
    window.localStorage.setItem(storageKey(userId), value)
    return
  }
  await SecureStore.setItemAsync(storageKey(userId), value)
}
