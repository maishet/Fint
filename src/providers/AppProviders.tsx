import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider, ToastViewport } from '@tamagui/toast'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'
import { Platform, useColorScheme } from 'react-native'
import { TamaguiProvider, Theme, type TamaguiProviderProps } from 'tamagui'
import { config } from '../../tamagui.config'
import { loadStoredLanguage } from '../i18n'
import { AuthProvider } from '../auth/AuthProvider'
import { ThemeModeContext, type ThemePreference } from '../theme/ThemeMode'
import { CurrentToast } from '../ui/CurrentToast'
import { SensitiveAmountsProvider } from '../privacy/SensitiveAmountsProvider'

const themeModeStorageKey = 'fint-theme-mode'

export function AppProviders({ children, ...rest }: Omit<TamaguiProviderProps, 'config' | 'defaultTheme'>) {
  const colorScheme = useColorScheme()
  const [queryClient] = useState(() => new QueryClient())
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
        <ToastProvider swipeDirection="horizontal" duration={5000}>
          <Theme name={themeMode} forceClassName>
            <QueryClientProvider client={queryClient}>
              <AuthProvider><SensitiveAmountsProvider>{children}</SensitiveAmountsProvider></AuthProvider>
            </QueryClientProvider>
          </Theme>
          <CurrentToast />
          <ToastViewport top="$8" left={0} right={0} />
        </ToastProvider>
      </TamaguiProvider>
    </ThemeModeContext.Provider>
  )
}

async function getStoredThemeMode() {
  const value = Platform.OS === 'web' ? window.localStorage.getItem(themeModeStorageKey) : await SecureStore.getItemAsync(themeModeStorageKey)
  return value === 'light' || value === 'dark' || value === 'system' ? value : null
}

async function storeThemeMode(themeMode: ThemePreference) {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(themeModeStorageKey, themeMode)
    return
  }

  await SecureStore.setItemAsync(themeModeStorageKey, themeMode)
}
