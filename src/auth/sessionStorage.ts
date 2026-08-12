import * as SecureStore from 'expo-secure-store'

export const sessionStorage = {
  async getItem(key: string) {
    return SecureStore.getItemAsync(key)
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value)
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key)
  },
}
