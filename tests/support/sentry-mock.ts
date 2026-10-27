import { mock } from 'bun:test'

export const captureException = mock((_error?: unknown, _context?: unknown) => undefined)
export const captureMessage = mock((_message: string, _context?: unknown) => undefined)

export const sentryMock = { captureException, captureMessage }
