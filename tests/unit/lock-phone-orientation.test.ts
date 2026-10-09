import { beforeEach, expect, mock, test } from 'bun:test'

type Listener = () => void

let screen = { width: 411, height: 797 }
let listeners: Listener[] = []
const lockAsync = mock(async () => {})
const unlockAsync = mock(async () => {})
const captureException = mock(() => {})

mock.module('react-native', () => ({
  Platform: { OS: 'android' },
  Dimensions: {
    get: () => screen,
    addEventListener: (_: string, fn: Listener) => {
      listeners.push(fn)
      return { remove: () => { listeners = listeners.filter((l) => l !== fn) } }
    },
  },
}))
mock.module('expo-screen-orientation', () => ({
  lockAsync,
  unlockAsync,
  OrientationLock: { PORTRAIT_UP: 'PORTRAIT_UP' },
}))
mock.module('@sentry/react-native', () => ({ captureException }))

const { isCompactScreen, lockPhoneOrientation } = await import('../../src/device/lockPhoneOrientation')

const flush = () => new Promise((r) => setTimeout(r, 0))
const resize = async (next: { width: number; height: number }) => {
  screen = next
  for (const l of listeners) l()
  await flush()
}

beforeEach(() => {
  listeners = []
  lockAsync.mockClear()
  unlockAsync.mockClear()
})

test('compact screen is under 600dp on its smallest side', () => {
  screen = { width: 411, height: 797 }
  expect(isCompactScreen()).toBe(true)
  screen = { width: 841, height: 701 }
  expect(isCompactScreen()).toBe(false)
  screen = { width: 1280, height: 800 }
  expect(isCompactScreen()).toBe(false)
})

test('foldable opened at launch gets locked only once it is closed', async () => {
  screen = { width: 841, height: 701 }
  const stop = lockPhoneOrientation()
  await flush()
  expect(lockAsync).not.toHaveBeenCalled()
  expect(unlockAsync).not.toHaveBeenCalled()

  await resize({ width: 411, height: 797 })
  expect(lockAsync).toHaveBeenCalledTimes(1)
  expect(lockAsync).toHaveBeenCalledWith('PORTRAIT_UP')

  await resize({ width: 841, height: 701 })
  expect(unlockAsync).toHaveBeenCalledTimes(1)

  await resize({ width: 411, height: 797 })
  expect(lockAsync).toHaveBeenCalledTimes(2)

  stop()
  await resize({ width: 841, height: 701 })
  expect(unlockAsync).toHaveBeenCalledTimes(1)
})

test('rotating a locked phone does not re-lock', async () => {
  await resize({ width: 411, height: 797 })
  expect(lockAsync).not.toHaveBeenCalled()
  await resize({ width: 797, height: 411 })
  expect(lockAsync).not.toHaveBeenCalled()
})
