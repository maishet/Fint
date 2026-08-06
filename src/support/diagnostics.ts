let lastRequestId: string | null = null
const SUPPORT_EMAIL = 'support@myfint.app'

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
  if (typeof navigator !== 'undefined') return 'web'
  return 'test'
}

export function buildSupportMailto(input: { category: string; description: string; steps?: string; includeDiagnostics: boolean }) {
  const diagnostics = getSupportDiagnostics()
  const body = [
    `Categoria: ${input.category}`,
    '',
    'Descripcion:',
    input.description,
    '',
    'Pasos para reproducir:',
    input.steps?.trim() || 'No indicado',
    '',
    `Version: ${diagnostics.appVersion}`,
    `Build: ${diagnostics.buildNumber}`,
    `Plataforma: ${diagnostics.platform}`,
    `Ambiente: ${diagnostics.environment}`,
    input.includeDiagnostics && diagnostics.diagnosticId ? `ID de diagnostico: ${diagnostics.diagnosticId}` : 'ID de diagnostico: no adjunto',
    '',
    'No adjuntes tokens, correos, montos, notas, headers, cookies ni cuerpos HTTP.',
  ].join('\n')
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Fint - ${input.category}`)}&body=${encodeURIComponent(body)}`
}
