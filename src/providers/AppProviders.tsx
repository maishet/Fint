import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import { TamaguiProvider, Theme, type TamaguiProviderProps } from 'tamagui'
import { config } from '../../tamagui.config'
import { loadStoredLanguage } from '../i18n'
import { ApiRequestError } from '../api/client'
import { AuthProvider } from '../auth/AuthProvider'
import { ThemeModeContext, type ThemePreference } from '../theme/ThemeMode'
import { FintToaster } from '../ui/FintToaster'
import { SensitiveAmountsProvider } from '../privacy/SensitiveAmountsProvider'
import { DailyRemindersProvider } from '../notifications/DailyRemindersProvider'
import { fileSystemPersister } from './queryPersister'
import { setupOnlineManager } from './networkStatus'

const themeModeStorageKey = 'fint-theme-mode'
const cacheMaxAge = 24 * 60 * 60 * 1000

setupOnlineManager()

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 30_000,
        gcTime: cacheMaxAge,
      },
      mutations: { retry: false },
    },
  })
}

export function AppProviders({ children, ...rest }: Omit<TamaguiProviderProps, 'config' | 'defaultTheme'>) {
  const colorScheme = useColorScheme()
  const [queryClient] = useState(createQueryClient)
  const [themePreference, setThemePreference] = useState<ThemePreference>('system')
  const themeMode = themePreference === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : themePreference

  useEffect(() => {
    void loadStoredLanguage()
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadThemeMode() {
      const storedThemeMode = await getStoredThemeMode()
      if (isMounted && storedThemeMode) setThemePreference(storedThemeMode)
    }

    loadThemeMode()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    storeThemeMode(themePreference)
  }, [themePreference])

  return (
    <ThemeModeContext.Provider value={{ themeMode, themePreference, setThemePreference }}>
      <TamaguiProvider config={config} defaultTheme={themeMode} {...rest}>
        <Theme name={themeMode} forceClassName>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: fileSystemPersister,
              maxAge: cacheMaxAge,
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => query.state.status === 'success',
                shouldDehydrateMutation: () => false,
              },
            }}
          >
            <AuthProvider><SensitiveAmountsProvider><DailyRemindersProvider>{children}</DailyRemindersProvider></SensitiveAmountsProvider></AuthProvider>
          </PersistQueryClientProvider>
          <FintToaster />
        </Theme>
      </TamaguiProvider>
    </ThemeModeContext.Provider>
  )
}

async function getStoredThemeMode() {
  const value = await SecureStore.getItemAsync(themeModeStorageKey)
  return value === 'light' || value === 'dark' || value === 'system' ? value : null
}

async function storeThemeMode(themeMode: ThemePreference) {
  await SecureStore.setItemAsync(themeModeStorageKey, themeMode)
}
