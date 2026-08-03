const sensitiveSentryKeyPattern = /amount|balance|currency|note|description|email|sender|subject|token|jwt|cookie|header|body|account|category|merchant|phone|address|password|authorization/i
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const tokenLikePattern = /(ExponentPushToken\[[^\]]+\]|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+[^\s]+)/gi

export function sanitizeSentryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeSentryValue)
  if (typeof value === 'string') return sanitizeSentryString(value)
  if (!value || typeof value !== 'object') return value

  const sanitized: Record<string, unknown> = {}
  for (const [key, childValue] of Object.entries(value)) {
    if (sensitiveSentryKeyPattern.test(key)) {
      sanitized[key] = '[Filtered]'
      continue
    }
    sanitized[key] = sanitizeSentryValue(childValue)
  }
  return sanitized
}

export function sanitizeSentryString(value: string) {
  return stripUrlQuery(value).replace(emailPattern, '[FilteredEmail]').replace(tokenLikePattern, '[FilteredToken]')
}

export function stripUrlQuery(value: string) {
  return value.replace(/https?:\/\/[^\s?#]+\?[^\s]*/g, (match) => match.split('?')[0] ?? match)
}
