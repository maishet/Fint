export type AnalyticsEventName = keyof typeof analyticsEventProperties

export type AnalyticsEventProperties = {
  [Name in AnalyticsEventName]: Record<(typeof analyticsEventProperties)[Name][number], string | number | boolean | null | undefined>
}

export const analyticsEnabledStorageKey = 'fint-analytics-enabled'

export const analyticsEventProperties = {
  onboarding_started: [],
  onboarding_completed: [],
  account_created: [],
  transaction_created: ['type'],
  debt_created: [],
  debt_payment_recorded: [],
  gmail_connection_started: [],
  gmail_connection_completed: [],
  gmail_reconnect_required: [],
  gmail_sync_completed: ['status', 'durationBucket'],
  pending_movement_confirmed: [],
  pending_movement_discarded: [],
  report_opened: ['reportType'],
  support_report_started: ['category'],
  support_report_submitted: ['category'],
} as const

const prohibitedPropertyPattern = /amount|balance|currency|note|description|email|sender|subject|token|jwt|cookie|header|body|accountName|categoryName|merchant|phone|address|advertising/i

export async function isAnalyticsEnabled() {
  const value = canUseLocalStorage() ? window.localStorage.getItem(analyticsEnabledStorageKey) : await getSecureStoreItem(analyticsEnabledStorageKey)
  return value !== 'false'
}

export async function setAnalyticsEnabled(enabled: boolean) {
  const value = enabled ? 'true' : 'false'
  if (canUseLocalStorage()) window.localStorage.setItem(analyticsEnabledStorageKey, value)
  else await setSecureStoreItem(analyticsEnabledStorageKey, value)
}

export function validateAnalyticsEvent<Name extends AnalyticsEventName>(name: Name, properties: Partial<AnalyticsEventProperties[Name]> = {}) {
  const allowed = new Set<string>(analyticsEventProperties[name])
  const invalid = Object.keys(properties).filter((key) => !allowed.has(key) || prohibitedPropertyPattern.test(key))
  if (invalid.length > 0) throw new Error(`Analytics event ${name} includes prohibited or undeclared properties: ${invalid.join(', ')}`)
}

export async function trackAnalyticsEvent<Name extends AnalyticsEventName>(name: Name, properties: Partial<AnalyticsEventProperties[Name]> = {}) {
  validateAnalyticsEvent(name, properties)
  if (!(await isAnalyticsEnabled())) return
  if (__DEV__) console.info('[analytics-preview]', name, properties)
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

async function getSecureStoreItem(key: string) {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return null
  const secureStore = await import('expo-secure-store')
  return secureStore.getItemAsync(key)
}

async function setSecureStoreItem(key: string, value: string) {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') return
  const secureStore = await import('expo-secure-store')
  await secureStore.setItemAsync(key, value)
}
