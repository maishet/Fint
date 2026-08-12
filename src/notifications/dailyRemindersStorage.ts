import * as SecureStore from 'expo-secure-store'

const keyPrefix = 'fint-daily-reminders-enabled'

function storageKey(userId: string) {
  return `${keyPrefix}-${userId}`
}

export async function getStoredDailyRemindersEnabled(userId: string) {
  const value = await SecureStore.getItemAsync(storageKey(userId))
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export async function storeDailyRemindersEnabled(userId: string, enabled: boolean) {
  await SecureStore.setItemAsync(storageKey(userId), enabled ? 'true' : 'false')
}
