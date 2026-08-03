import { describe, expect, it } from 'bun:test'
import { sanitizeSentryString, sanitizeSentryValue, stripUrlQuery } from '../../src/monitoring/sentryPrivacy'

describe('Sentry privacy sanitizer', () => {
  it('strips query strings from URLs', () => {
    expect(stripUrlQuery('GET https://api.fint.test/api/me?access_token=secret&email=user@test.com')).toBe('GET https://api.fint.test/api/me')
  })

  it('filters emails and token-like values from strings', () => {
    const value = sanitizeSentryString('Bearer abc.def.ghi user test@example.com ExponentPushToken[secret]')
    expect(value).not.toContain('test@example.com')
    expect(value).not.toContain('ExponentPushToken[secret]')
    expect(value).toContain('[FilteredEmail]')
    expect(value).toContain('[FilteredToken]')
  })

  it('filters sensitive object keys recursively', () => {
    const result = sanitizeSentryValue({
      operation: 'report_export_pdf',
      amount: 1200,
      nested: {
        accountName: 'Banco QA',
        url: 'https://api.fint.test/api/transactions?token=secret',
      },
      breadcrumbs: [{ category: 'http', data: { headers: { authorization: 'Bearer secret' } } }],
    })

    expect(result).toEqual({
      operation: 'report_export_pdf',
      amount: '[Filtered]',
      nested: {
        accountName: '[Filtered]',
        url: 'https://api.fint.test/api/transactions',
      },
      breadcrumbs: [{ category: '[Filtered]', data: { headers: '[Filtered]' } }],
    })
  })
})
