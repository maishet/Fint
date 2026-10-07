import { File, Paths } from 'expo-file-system'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

const CACHE_FILE_NAME = 'fint-query-cache.json'

function cacheFile() {
  return new File(Paths.cache, CACHE_FILE_NAME)
}

function removeLegacyDocumentCache() {
  try {
    const legacy = new File(Paths.document, CACHE_FILE_NAME)
    if (legacy.exists) legacy.delete()
  } catch {
    // no-op
  }
}

export const fileSystemPersister: Persister = {
  persistClient(client: PersistedClient) {
    try {
      const file = cacheFile()
      file.create({ overwrite: true })
      file.write(JSON.stringify(client))
    } catch {
      // no-op
    }
  },
  async restoreClient() {
    removeLegacyDocumentCache()
    try {
      const file = cacheFile()
      if (!file.exists) return undefined
      const text = await file.text()
      if (!text) return undefined
      return JSON.parse(text) as PersistedClient
    } catch {
      return undefined
    }
  },
  removeClient() {
    removeLegacyDocumentCache()
    try {
      const file = cacheFile()
      if (file.exists) file.delete()
    } catch {
      // no-op
    }
  },
}
