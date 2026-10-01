import { expect, test } from 'bun:test'
import { holdModal, isModalHeld, subscribeModalHeld } from '../../src/ui/modalHold'

test('el fondo se oculta mientras haya al menos una hoja abierta', () => {
  expect(isModalHeld()).toBe(false)
  const first = holdModal()
  const second = holdModal()
  expect(isModalHeld()).toBe(true)
  first()
  expect(isModalHeld()).toBe(true)
  second()
  expect(isModalHeld()).toBe(false)
})

test('soltar dos veces la misma hoja no resta de más', () => {
  const release = holdModal()
  const other = holdModal()
  release()
  release()
  expect(isModalHeld()).toBe(true)
  other()
  expect(isModalHeld()).toBe(false)
})

test('avisa a quien escucha cada cambio y deja de avisar al darse de baja', () => {
  let calls = 0
  const unsubscribe = subscribeModalHeld(() => {
    calls += 1
  })
  const release = holdModal()
  release()
  expect(calls).toBe(2)
  unsubscribe()
  holdModal()()
  expect(calls).toBe(2)
})
