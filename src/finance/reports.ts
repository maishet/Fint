export type ReportPeriodPreset = 'currentMonth' | 'previousMonth' | 'last3Months' | 'last6Months'

export function getPresetRange(preset: ReportPeriodPreset, today = new Date()) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  if (preset === 'previousMonth') return toRange(new Date(today.getFullYear(), today.getMonth() - 1, 1), monthStart)
  if (preset === 'last3Months') return toRange(new Date(today.getFullYear(), today.getMonth() - 2, 1), new Date(today.getFullYear(), today.getMonth() + 1, 1))
  if (preset === 'last6Months') return toRange(new Date(today.getFullYear(), today.getMonth() - 5, 1), new Date(today.getFullYear(), today.getMonth() + 1, 1))
  return toRange(monthStart, new Date(today.getFullYear(), today.getMonth() + 1, 1))
}

export function getPreviousRange(from: string, to: string) {
  const start = parseDate(from)
  const end = parseDate(to)
  if (start.getUTCDate() === 1 && end.getUTCDate() === 1) {
    const monthSpan = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
    if (monthSpan > 0) return { from: toIsoDate(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - monthSpan, 1))), to: from }
  }
  return { from: toIsoDate(new Date(start.getTime() - (end.getTime() - start.getTime()))), to: from }
}

function toRange(from: Date, to: Date) {
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

function parseDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid report date: ${value}`)
  return date
}

function toIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
