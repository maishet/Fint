import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { AppState, Platform } from 'react-native'
import { supabase } from './supabase'
import { completeAuthSession } from './completeAuthSession'
import { registerPushInstallation, unregisterPushInstallation } from '../notifications/pushNotifications'

interface AuthResult {
  error: Error | null
}

interface AuthContextValue {
  isLoading: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult>
  signInWithGoogle: (redirectTo: string) => Promise<AuthResult>
  updateDisplayName: (displayName: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setIsLoading(false)
      logSessionExpiry(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setIsLoading(false)
      logSessionExpiry(nextSession)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  useEffect(() => {
    if (Platform.OS === 'web') return

    supabase.auth.startAutoRefresh()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    })

    return () => {
      subscription.remove()
      supabase.auth.stopAutoRefresh()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    registerPushInstallation().catch((error) => console.warn('[Fint Push] automatic register failed', error instanceof Error ? error.message : String(error)))
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
      },
      async signUp(email, password, displayName) {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim() } } })
        return { error }
      },
      async signInWithGoogle(redirectTo) {
        logOAuthDebug('redirectTo', redirectTo)
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        })
        if (error || !data.url) return { error }
        logOAuthDebug('providerUrl', redactUrl(data.url))

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
        if (result.type !== 'success') return { error: null }
        logOAuthDebug('callbackUrl', redactUrl(result.url))

        const { error: sessionError } = await completeAuthSession({ url: result.url })
        return { error: sessionError }
      },
      async updateDisplayName(displayName) {
        const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } })
        return { error }
      },
      async signOut() {
        await unregisterPushInstallation().catch(() => undefined)
        const { error } = await supabase.auth.signOut()
        if (error) {
          const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
          if (localError) throw localError
        }
        setSession(null)
        queryClient.clear()
      },
    }),
    [isLoading, queryClient, session]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

function logOAuthDebug(label: string, value: string) {
  if (__DEV__) console.log(`[Fint OAuth] ${label}: ${value}`)
}

function logSessionExpiry(session: Session | null) {
  if (!__DEV__ || !session?.expires_at) return
  console.log(`[Fint Auth] Access token expires at ${new Date(session.expires_at * 1000).toISOString()} and will refresh automatically.`)
}

function redactUrl(url: string) {
  return url
    .replace(/([?#&]code=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]access_token=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]refresh_token=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]provider_token=)[^&#]+/g, '$1<redacted>')
    .replace(/([?#&]provider_refresh_token=)[^&#]+/g, '$1<redacted>')
}
