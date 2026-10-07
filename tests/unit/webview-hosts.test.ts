import { expect, test } from 'bun:test'
import { httpsHostname, isAllowedInsideWebView, shouldOpenOutside } from '../../src/settings/webViewHosts'

const featurebase = { hosts: ['my-fint.featurebase.app'] }

test('keeps the Featurebase board inside the WebView', () => {
  expect(isAllowedInsideWebView('https://my-fint.featurebase.app', featurebase)).toBe(true)
  expect(isAllowedInsideWebView('https://my-fint.featurebase.app/p/idea?b=1#c', featurebase)).toBe(true)
  expect(isAllowedInsideWebView('https://MY-FINT.featurebase.app:443/', featurebase)).toBe(true)
})

test('rejects URLs whose real host is not the board', () => {
  for (const url of [
    'https://evil.com/@my-fint.featurebase.app',
    'https://my-fint.featurebase.app@evil.com',
    'https://my-fint.featurebase.app:443@evil.com/',
    'https://evil.com\\@my-fint.featurebase.app',
    'https://my-fint.featurebase.app\\@evil.com',
    'https://other-company.featurebase.app',
    'https://my-fint.featurebase.app.evil.com',
    'http://my-fint.featurebase.app',
    'javascript:alert(1)//my-fint.featurebase.app',
  ]) {
    expect(isAllowedInsideWebView(url, featurebase)).toBe(false)
  }
})

test('domain rules accept the domain and its subdomains only', () => {
  const rules = { domains: ['myfint.app'] }
  expect(isAllowedInsideWebView('https://myfint.app/privacy', rules)).toBe(true)
  expect(isAllowedInsideWebView('https://www.myfint.app/terms', rules)).toBe(true)
  expect(isAllowedInsideWebView('https://evilmyfint.app', rules)).toBe(false)
  expect(isAllowedInsideWebView('https://myfint.app.evil.com', rules)).toBe(false)
})

test('extracts the host the browser would actually load', () => {
  expect(httpsHostname('https://evil.com/@my-fint.featurebase.app')).toBe('evil.com')
  expect(httpsHostname('https://user@evil.com')).toBeNull()
  expect(httpsHostname(undefined)).toBeNull()
})

test('only top-frame web links are handed to the browser', () => {
  expect(shouldOpenOutside('https://featurebase.app', true)).toBe(true)
  expect(shouldOpenOutside('https://featurebase.app', undefined)).toBe(true)
  expect(shouldOpenOutside('https://ads.example/frame', false)).toBe(false)
  expect(shouldOpenOutside('intent://scan/#Intent;end', true)).toBe(false)
})
