import { useEffect, useState } from 'react'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import * as Linking from 'expo-linking'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { H2, Paragraph, Spinner, YStack } from 'tamagui'
import { supabase } from '../../src/auth/supabase'
import { FintButton, FintCard } from '../../src/ui'

export default function AuthCallbackScreen() {
  const router = useRouter()
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>()
  const callbackUrl = Linking.useURL()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [debugMessage, setDebugMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function exchangeCode() {
      if (!callbackUrl && !code && !error_description) return

      if (__DEV__) {
        setDebugMessage(getDebugMessage(callbackUrl))
        console.log('[Fint OAuth Callback]', getDebugMessage(callbackUrl))
      }

      if (error_description) {
        setErrorMessage(error_description)
        return
      }

      const params = getOAuthCallbackParams(callbackUrl)
      if (params.access_token && params.refresh_token) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          })
          if (!isMounted) return
          if (error || !data.session) {
            setErrorMessage(error?.message ?? 'No pudimos guardar la sesion de Google. Intenta nuevamente.')
            return
          }
          if (__DEV__) console.log('[Fint OAuth Callback] session established')
          router.replace('/(tabs)/dashboard')
        } catch (error) {
          if (!isMounted) return
          setErrorMessage(error instanceof Error ? error.message : 'No pudimos guardar la sesion de Google. Intenta nuevamente.')
        }
        return
      }

      const authCode = code ?? params.code
      if (!authCode) {
        const session = await waitForSession()
        if (!isMounted) return
        if (session) {
          router.replace('/(tabs)/dashboard')
          return
        }

        setErrorMessage('No pudimos completar el inicio con Google. Vuelve al login e intenta nuevamente.')
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(authCode)
      if (!isMounted) return
      if (error) {
        setErrorMessage(
          error.message.includes('auth session missing')
            ? 'Google devolvio un codigo, pero la app no encontro la sesion temporal necesaria para validarlo. Vuelve al login e intenta nuevamente.'
            : error.message
        )
        return
      }
      router.replace('/(tabs)/dashboard')
    }

    exchangeCode()

    return () => {
      isMounted = false
    }
  }, [callbackUrl, code, error_description, router])

  return (
    <YStack flex={1} items="center" justify="center" gap="$4" p="$5" bg="$background">
      {errorMessage ? (
        <FintCard width="100%" maxW={360} gap="$4" p="$5">
          <YStack gap="$2" items="center">
            <H2 color="$color12" fontFamily="$heading" size="$7" text="center">No se pudo iniciar sesion</H2>
            <Paragraph color="$color10" text="center" lineHeight="$5">
              {errorMessage}
            </Paragraph>
            {debugMessage ? (
              <Paragraph color="$color9" fontSize="$2" text="center" lineHeight="$3">
                Debug: {debugMessage}
              </Paragraph>
            ) : null}
          </YStack>
          <FintButton onPress={() => router.replace('/login')}>Volver al login</FintButton>
        </FintCard>
      ) : (
        <YStack items="center" gap="$3">
          <Spinner size="large" color="$accent10" />
          <Paragraph color="$color10">Completando inicio de sesion...</Paragraph>
        </YStack>
      )}
    </YStack>
  )
}

function getOAuthCallbackParams(url: string | null) {
  if (!url) return {}

  const { params, errorCode } = QueryParams.getQueryParams(url)
  if (__DEV__ && errorCode) console.log('[Fint OAuth Callback] errorCode', errorCode)

  return {
    code: getStringParam(params.code),
    access_token: getStringParam(params.access_token),
    refresh_token: getStringParam(params.refresh_token),
  }
}

function getStringParam(value: unknown) {
  return typeof value === 'string' ? value : null
}

async function waitForSession() {
  for (let index = 0; index < 8; index += 1) {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return null
}

function getDebugMessage(url: string | null) {
  if (!url) return 'url=null'
  const params = getOAuthCallbackParams(url)
  return `url=${redactUrl(url)}; hasCode=${Boolean(params.code)}; hasAccessToken=${Boolean(params.access_token)}; hasRefreshToken=${Boolean(params.refresh_token)}`
}

function redactUrl(url: string) {
  return url
    .replace(/([?#&]code=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]access_token=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]refresh_token=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]provider_token=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]provider_refresh_token=)[^&#]+/g, '$1<redacted>')
}
