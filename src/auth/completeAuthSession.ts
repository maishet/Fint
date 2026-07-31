import type { Session } from '@supabase/supabase-js'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import { supabase } from './supabase'

interface CompleteAuthSessionInput {
  code?: string | null
  url?: string | null
}

interface CompleteAuthSessionResult {
  error: Error | null
  session: Session | null
}

let activeCompletion: Promise<CompleteAuthSessionResult> | null = null
let resetTimer: ReturnType<typeof setTimeout> | null = null

export function completeAuthSession(input: CompleteAuthSessionInput) {
  if (activeCompletion) return activeCompletion

  if (resetTimer) clearTimeout(resetTimer)
  activeCompletion = complete(input)
  activeCompletion.then(scheduleReset, scheduleReset)
  return activeCompletion
}

async function complete({ code, url }: CompleteAuthSessionInput): Promise<CompleteAuthSessionResult> {
  const params = getAuthCallbackParams(url)
  if (params.errorCode) return { error: new Error(params.errorCode), session: null }

  if (params.accessToken && params.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    })
    return { error, session: data.session }
  }

  const authCode = code ?? params.code
  if (authCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode)
    return { error, session: data.session }
  }

  const { data, error } = await supabase.auth.getSession()
  return { error, session: data.session }
}

function getAuthCallbackParams(url?: string | null) {
  if (!url) return { accessToken: null, code: null, errorCode: null, refreshToken: null }

  const { params, errorCode } = QueryParams.getQueryParams(url)
  return {
    accessToken: getStringParam(params.access_token),
    code: getStringParam(params.code),
    errorCode: errorCode ?? null,
    refreshToken: getStringParam(params.refresh_token),
  }
}

function getStringParam(value: unknown) {
  return typeof value === 'string' ? value : null
}

function scheduleReset() {
  resetTimer = setTimeout(() => {
    activeCompletion = null
    resetTimer = null
  }, 10_000)
}
