let lastRequestId: string | null = null

export function setLastRequestId(requestId: string | null) {
  lastRequestId = requestId
}

export function getLastRequestId() {
  return lastRequestId
}

export function getSupportDiagnostics() {
  return {
    appVersion: process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0',
    buildNumber: process.env.EXPO_PUBLIC_BUILD_NUMBER ?? 'dev',
    platform: getPlatformName(),
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    diagnosticId: lastRequestId,
  }
}

function getPlatformName() {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') return 'native'
  return 'test'
}
