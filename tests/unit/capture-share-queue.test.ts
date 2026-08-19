import { describe, expect, test } from 'bun:test'
import {
  MAX_SHARE_QUEUE_SIZE,
  partitionExpired,
  remainingCapacity,
  SHARE_QUEUE_TTL_MS,
  splitByCapacity,
  type QueuedShareImage,
} from '../../src/capture/share-queue-logic'

function item(uri: string, expiresAt: number): QueuedShareImage {
  return { uri, expiresAt }
}

describe('splitByCapacity — tope de la cola', () => {
  test('8 imágenes con la cola vacía ⇒ acepta 5, descarta 3', () => {
    const paths = Array.from({ length: 8 }, (_, i) => `content://img-${i}`)
    const result = splitByCapacity(paths, 0)
    expect(result.accepted).toHaveLength(5)
    expect(result.accepted).toEqual(paths.slice(0, 5))
    expect(result.droppedCount).toBe(3)
  })

  test('la cola ya tiene elementos ⇒ la capacidad restante se reduce', () => {
    const result = splitByCapacity(['a', 'b', 'c'], 3)
    expect(result.accepted).toEqual(['a', 'b'])
    expect(result.droppedCount).toBe(1)
  })

  test('la cola ya está en el tope ⇒ todo se descarta', () => {
    const result = splitByCapacity(['a', 'b'], MAX_SHARE_QUEUE_SIZE)
    expect(result.accepted).toEqual([])
    expect(result.droppedCount).toBe(2)
  })

  test('menos imágenes que la capacidad disponible ⇒ nada se descarta', () => {
    const result = splitByCapacity(['a', 'b'], 0)
    expect(result.accepted).toEqual(['a', 'b'])
    expect(result.droppedCount).toBe(0)
  })
})

describe('remainingCapacity', () => {
  test('nunca es negativa aunque existingCount exceda el máximo', () => {
    expect(remainingCapacity(MAX_SHARE_QUEUE_SIZE + 10)).toBe(0)
  })
})

describe('partitionExpired — TTL de 15 minutos', () => {
  test('separa lo vigente de lo expirado según el instante dado', () => {
    const now = 1_000_000
    const queue = [item('fresh', now + 1), item('expired', now - 1), item('boundary', now)]
    const { fresh, expired } = partitionExpired(queue, now)
    expect(fresh.map((i) => i.uri)).toEqual(['fresh'])
    expect(expired.map((i) => i.uri)).toEqual(['expired', 'boundary'])
  })

  test('una cola sin elementos expirados no descarta nada', () => {
    const now = 1_000_000
    const queue = [item('a', now + SHARE_QUEUE_TTL_MS), item('b', now + 1)]
    const { fresh, expired } = partitionExpired(queue, now)
    expect(fresh).toHaveLength(2)
    expect(expired).toHaveLength(0)
  })

  test('una cola vacía no revienta', () => {
    expect(partitionExpired([], Date.now())).toEqual({ fresh: [], expired: [] })
  })
})
