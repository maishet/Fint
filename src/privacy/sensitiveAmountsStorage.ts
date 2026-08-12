import * as SecureStore from 'expo-secure-store'

const keyPrefix = 'fint-sensitive-amounts-visible'

function storageKey(userId: string) {
  return `${keyPrefix}-${userId}`
}

export async function getStoredSensitiveAmountsVisible(userId: string) {
  const value = await SecureStore.getItemAsync(storageKey(userId))
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export async function storeSensitiveAmountsVisible(userId: string, visible: boolean) {
  await SecureStore.setItemAsync(storageKey(userId), visible ? 'true' : 'false')
}
