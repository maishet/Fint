const HTTPS_ORIGIN = /^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::\d{1,5})?(?:[/?#]|$)/i

export function httpsHostname(rawUrl: string | undefined | null): string | null {
  if (!rawUrl) return null
  const match = HTTPS_ORIGIN.exec(rawUrl)
  return match ? match[1].toLowerCase() : null
}

export interface WebViewHostRules {
  hosts?: string[]
  domains?: string[]
}

export function isAllowedInsideWebView(rawUrl: string, { hosts = [], domains = [] }: WebViewHostRules): boolean {
  const hostname = httpsHostname(rawUrl)
  if (!hostname) return false
  return hosts.includes(hostname) || domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
}

export function shouldOpenOutside(rawUrl: string, isTopFrame: boolean | undefined): boolean {
  return isTopFrame !== false && /^https?:\/\//i.test(rawUrl)
}
