import { Directory, File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import { randomId } from '../shared/id'

const QUEUE_STORAGE_KEY = 'fint-share-queue'
const SHARE_DIR_NAME = 'fint-share'
const MAX_QUEUE_SIZE = 5
const QUEUE_TTL_MS = 15 * 60 * 1000

type QueuedShareImage = {
  uri: string
  expiresAt: number
}

function shareDirectory(): Directory {
  const dir = new Directory(Paths.cache, SHARE_DIR_NAME)
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

function deleteIfExists(file: File): void {
  try {
    if (file.exists) file.delete()
  } catch {
    // Best-effort: un archivo que no se puede borrar no debe tumbar la cola.
  }
}

async function readQueue(): Promise<QueuedShareImage[]> {
  const raw = await SecureStore.getItemAsync(QUEUE_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueuedShareImage[]) : []
  } catch {
    return []
  }
}

async function writeQueue(queue: QueuedShareImage[]): Promise<void> {
  if (queue.length === 0) {
    await SecureStore.deleteItemAsync(QUEUE_STORAGE_KEY)
    return
  }
  await SecureStore.setItemAsync(QUEUE_STORAGE_KEY, JSON.stringify(queue))
}

async function purgeExpired(): Promise<QueuedShareImage[]> {
  const queue = await readQueue()
  const now = Date.now()
  const fresh = queue.filter((item) => item.expiresAt > now)
  for (const item of queue) {
    if (item.expiresAt <= now) deleteIfExists(new File(item.uri))
  }
  if (fresh.length !== queue.length) await writeQueue(fresh)
  return fresh
}

export async function enqueueSharedFiles(sourcePaths: string[]): Promise<void> {
  const existing = await purgeExpired()
  const capacity = MAX_QUEUE_SIZE - existing.length
  if (capacity <= 0) return

  const now = Date.now()
  const added: QueuedShareImage[] = []
  for (const sourcePath of sourcePaths.slice(0, capacity)) {
    try {
      const dest = new File(shareDirectory(), `${randomId()}.bin`)
      new File(sourcePath).copy(dest)
      added.push({ uri: dest.uri, expiresAt: now + QUEUE_TTL_MS })
    } catch {
      // Un archivo compartido que no se pudo copiar simplemente se omite.
    }
  }
  if (added.length > 0) await writeQueue([...existing, ...added])
}

export async function hasQueuedShareFiles(): Promise<boolean> {
  const queue = await purgeExpired()
  return queue.length > 0
}

/** Vacía la cola y devuelve las rutas para procesar — llamar una sola vez, al entrar a capture-import. */
export async function consumeShareQueue(): Promise<string[]> {
  const queue = await purgeExpired()
  if (queue.length === 0) return []
  await writeQueue([])
  return queue.map((item) => item.uri)
}

/** Descarta la cola sin procesarla — capability apagada, o el usuario nunca llega a capture-import. */
export async function discardShareQueue(): Promise<void> {
  const queue = await readQueue()
  for (const item of queue) deleteIfExists(new File(item.uri))
  await writeQueue([])
}
