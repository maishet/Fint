import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import { Portal, TamaguiProvider, Theme, type TamaguiProviderProps } from 'tamagui'
import { config } from '../../tamagui.config'
import { loadStoredLanguage } from '../i18n'
import { ApiRequestError } from '../api/client'
import { AuthProvider } from '../auth/AuthProvider'
import { ThemeModeContext, type ThemePreference } from '../theme/ThemeMode'
import { FintToaster } from '../ui/FintToaster'
import { ModalScope } from '../ui/ModalScope'
import { SensitiveAmountsProvider } from '../privacy/SensitiveAmountsProvider'
import { DailyRemindersProvider } from '../notifications/DailyRemindersProvider'
import { LocationPreferenceProvider } from '../location/LocationPreferenceProvider'
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

  // Hasta leer la preferencia guardada no se escribe nada: si no, el 'system' inicial la pisaba al arrancar.
  const [isThemeLoaded, setIsThemeLoaded] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadThemeMode() {
      const storedThemeMode = await getStoredThemeMode().catch(() => null)
      if (!isMounted) return
      if (storedThemeMode) setThemePreference(storedThemeMode)
      setIsThemeLoaded(true)
    }

    loadThemeMode()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isThemeLoaded) void storeThemeMode(themePreference).catch(() => undefined)
  }, [isThemeLoaded, themePreference])

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
            <AuthProvider><SensitiveAmountsProvider><DailyRemindersProvider><LocationPreferenceProvider><ModalScope>{children}</ModalScope></LocationPreferenceProvider></DailyRemindersProvider></SensitiveAmountsProvider></AuthProvider>
          </PersistQueryClientProvider>
          {/*
            Los avisos van al mismo portal que las hojas (`FintSheet`, zIndex 110 000) y encima: montados aquí quedaban
            debajo del portal y un toast lanzado con una hoja abierta ("Deshacer", un error) salía detrás de ella.
            Por eso también quedan fuera de `ModalScope`, que oculta la app (no el portal) al lector con una hoja abierta.
          */}
          <Portal zIndex={200_000}>
            <FintToaster />
          </Portal>
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
