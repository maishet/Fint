import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import { sessionStorage } from './sessionStorage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined'
const realtimeTransport = globalThis.WebSocket ?? (class NoopWebSocket {} as unknown as typeof WebSocket)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  realtime: {
    transport: realtimeTransport,
  },
})
