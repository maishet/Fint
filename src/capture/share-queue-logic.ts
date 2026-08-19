export const MAX_SHARE_QUEUE_SIZE = 5
export const SHARE_QUEUE_TTL_MS = 15 * 60 * 1000

export type QueuedShareImage = {
  uri: string
  expiresAt: number
}

/** Separa lo que ya expiró (para borrar del disco) de lo que sigue vigente. */
export function partitionExpired(queue: QueuedShareImage[], now: number): { fresh: QueuedShareImage[]; expired: QueuedShareImage[] } {
  const fresh: QueuedShareImage[] = []
  const expired: QueuedShareImage[] = []
  for (const item of queue) {
    if (item.expiresAt > now) fresh.push(item)
    else expired.push(item)
  }
  return { fresh, expired }
}

/** Cuántos elementos nuevos caben antes de tocar el tope de la cola. */
export function remainingCapacity(existingCount: number, max: number = MAX_SHARE_QUEUE_SIZE): number {
  return Math.max(0, max - existingCount)
}

export type AcceptedShareBatch = {
  accepted: string[]
  droppedCount: number
}

/** Divide las rutas entrantes entre lo que cabe y lo que se descarta por tope. */
export function splitByCapacity(sourcePaths: string[], existingCount: number, max: number = MAX_SHARE_QUEUE_SIZE): AcceptedShareBatch {
  const capacity = remainingCapacity(existingCount, max)
  return {
    accepted: sourcePaths.slice(0, capacity),
    droppedCount: Math.max(0, sourcePaths.length - capacity),
  }
}
