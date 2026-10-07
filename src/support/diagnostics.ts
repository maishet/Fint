let lastRequestId: string | null = null

export function setLastRequestId(requestId: string | null) {
  lastRequestId = requestId
}

export function getLastRequestId() {
  return lastRequestId
}

export function getSupportDiagnostics() {
  const platform = getPlatformName()
  const installed = platform === 'native' ? installedVersion() : null
  return {
    appVersion: installed?.version ?? 'dev',
    buildNumber: installed?.build ?? 'dev',
    platform,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    diagnosticId: lastRequestId,
  }
}

function installedVersion(): { version: string | null; build: string | null } | null {
  try {
    const Application = require('expo-application') as typeof import('expo-application')
    return { version: Application.nativeApplicationVersion, build: Application.nativeBuildVersion }
  } catch {
    return null
  }
}

function getPlatformName() {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') return 'native'
  return 'test'
}
