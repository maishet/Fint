import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin'
import { AppState, Platform } from 'react-native'
import { supabase } from './supabase'
import { GOOGLE_SIGNIN_BASE_CONFIG } from './googleSignIn'
import { registerPushInstallation, unregisterPushInstallation } from '../notifications/pushNotifications'

if (Platform.OS !== 'web') {
  GoogleSignin.configure(GOOGLE_SIGNIN_BASE_CONFIG)
}

interface AuthResult {
  error: Error | null
}

interface AuthContextValue {
  isLoading: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
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
    registerPushInstallation().catch((error) => console.warn('[My Fint Push] automatic register failed', error instanceof Error ? error.message : String(error)))
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
      signInWithGoogle: signInWithGoogleNative,
      async updateDisplayName(displayName) {
        const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } })
        return { error }
      },
      async signOut() {
        await unregisterPushInstallation().catch(() => undefined)
        if (Platform.OS !== 'web') await GoogleSignin.signOut().catch(() => undefined)
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

async function signInWithGoogleNative(): Promise<AuthResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return { error: null }

    const idToken = response.data.idToken
    if (!idToken) return { error: new Error('missing_google_id_token') }

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
    return { error }
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return { error: null }
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }
}

function logSessionExpiry(session: Session | null) {
  if (!__DEV__ || !session?.expires_at) return
  console.log(`[My Fint Auth] Access token expires at ${new Date(session.expires_at * 1000).toISOString()} and will refresh automatically.`)
}
