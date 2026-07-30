import '../tamagui.generated.css'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { SplashScreen, Stack, useRouter } from 'expo-router'
import * as Sentry from '@sentry/react-native'
import { AppProviders } from '../src/providers/AppProviders'
import { useAuth } from '../src/auth/AuthProvider'
import { useThemeMode } from '../src/theme/ThemeMode'
import { useTheme } from 'tamagui'
import { attachNotificationResponseListener } from '../src/notifications/pushNotifications'

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
  initialRouteName: 'index',
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
})

function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    InterRegular: require('../assets/fonts/Inter_18pt-Regular.ttf'),
    InterMedium: require('../assets/fonts/Inter_18pt-Medium.ttf'),
    InterSemiBold: require('../assets/fonts/Inter_24pt-SemiBold.ttf'),
    InterBold: require('../assets/fonts/Inter_28pt-Bold.ttf'),
    SpaceGroteskRegular: require('../assets/fonts/SpaceGrotesk-Regular.ttf'),
    SpaceGroteskMedium: require('../assets/fonts/SpaceGrotesk-Medium.ttf'),
    SpaceGroteskSemiBold: require('../assets/fonts/SpaceGrotesk-SemiBold.ttf'),
    SpaceGroteskBold: require('../assets/fonts/SpaceGrotesk-Bold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      // Hide the splash screen after the fonts have loaded (or an error was returned) and the UI is ready.
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontsError])

  if (!fontsLoaded && !fontsError) {
    return null
  }

  return (
    <Providers>
      <RootLayoutNav />
    </Providers>
  )
}

const Providers = ({ children }: { children: React.ReactNode }) => {
  return <AppProviders>{children}</AppProviders>
}

export default Sentry.wrap(RootLayout)

function RootLayoutNav() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { themeMode } = useThemeMode()
  const theme = useTheme()
  const router = useRouter()

  useEffect(() => attachNotificationResponseListener(router), [router])

  return (
    <ThemeProvider value={themeMode === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
           <Stack.Screen name="transaction-form" options={{ title: t('forms.newMovement'), contentStyle: { backgroundColor: theme.background.val } }} />
           <Stack.Screen name="pending-movements" options={{ title: t('movementUx.pendingTitle', { defaultValue: 'Pendientes detectados' }), contentStyle: { backgroundColor: theme.background.val } }} />
           <Stack.Screen name="pending-review" options={{ title: t('movementUx.reviewPendingTitle', { defaultValue: 'Revisar pendiente' }), contentStyle: { backgroundColor: theme.background.val } }} />
          <Stack.Screen name="account-form" options={{ contentStyle: { backgroundColor: theme.background.val } }} />
          <Stack.Screen name="debt-form" options={{ contentStyle: { backgroundColor: theme.background.val } }} />
          <Stack.Screen name="settings" options={{ title: t('header.menuTitle'), contentStyle: { backgroundColor: theme.background.val } }} />
          <Stack.Screen name="profile" options={{ title: t('profile.title', { defaultValue: 'Mi perfil' }), contentStyle: { backgroundColor: theme.background.val } }} />
          <Stack.Screen name="gmail-settings" options={{ title: t('gmail.title'), contentStyle: { backgroundColor: theme.background.val } }} />
          <Stack.Screen name="support" options={{ title: t('support.title', { defaultValue: 'Ayuda y soporte' }), contentStyle: { backgroundColor: theme.background.val } }} />
          <Stack.Screen name="gmail-connected" options={{ headerShown: false }} />
          <Stack.Screen name="categories" options={{ title: t('categories.routeTitle'), contentStyle: { backgroundColor: theme.background.val } }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  )
}
