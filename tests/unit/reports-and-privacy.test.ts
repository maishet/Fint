import { expect, test } from 'bun:test'
import { getPresetRange, getPreviousRange } from '../../src/finance/reports'
import { buildSupportMailto, setLastRequestId } from '../../src/support/diagnostics'
import { validateAnalyticsEvent } from '../../src/analytics/privacy'

test('uses an equivalent previous range for comparisons', () => {
  expect(getPresetRange('currentMonth', new Date('2026-07-25T12:00:00')).from).toBe('2026-07-01')
  expect(getPreviousRange('2026-07-01', '2026-08-01')).toEqual({ from: '2026-06-01', to: '2026-07-01' })
  expect(getPreviousRange('2026-02-10', '2026-02-20')).toEqual({ from: '2026-01-31', to: '2026-02-10' })
})

test('rejects undeclared or sensitive analytics properties', () => {
  expect(() => validateAnalyticsEvent('transaction_created', { type: 'income' })).not.toThrow()
  expect(() => validateAnalyticsEvent('transaction_created', { amount: 100 } as never)).toThrow('prohibited')
  expect(() => validateAnalyticsEvent('support_report_submitted', { category: 'Gmail', email: 'user@example.com' } as never)).toThrow('prohibited')
})

test('support mailto includes safe diagnostics only with consent', () => {
  setLastRequestId('req_123')
  const url = buildSupportMailto({ category: 'Cuentas y saldos', description: 'No carga', includeDiagnostics: true })
  const decoded = decodeURIComponent(url)
  expect(decoded).toContain('ID de diagnostico: req_123')
  expect(decoded).toContain('No adjuntes tokens')
  expect(decoded).not.toContain('Authorization')
})
