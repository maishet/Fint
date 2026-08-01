import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const keyPrefix = 'fint-sensitive-amounts-visible'

function storageKey(userId: string) {
  return `${keyPrefix}-${userId}`
}

export async function getStoredSensitiveAmountsVisible(userId: string) {
  const value = Platform.OS === 'web' ? window.localStorage.getItem(storageKey(userId)) : await SecureStore.getItemAsync(storageKey(userId))
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export async function storeSensitiveAmountsVisible(userId: string, visible: boolean) {
  const value = visible ? 'true' : 'false'
  if (Platform.OS === 'web') {
    window.localStorage.setItem(storageKey(userId), value)
    return
  }
  await SecureStore.setItemAsync(storageKey(userId), value)
}
