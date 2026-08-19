import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { Image as RNImage } from 'react-native'
import { randomId } from '../shared/id'
import {
  assertSafeDimensions,
  assertSizeWithinLimit,
  assertUriAllowed,
  CaptureRejectedError,
  isRecognizedImageHeader,
  type CaptureRejectReason,
} from './image-validation'

export { CaptureRejectedError, type CaptureRejectReason }

export const MAX_CAPTURE_BATCH_SIZE = 5

const RECODE_TIMEOUT_MS = 8_000
const TARGET_WIDTH = 1600
const JPEG_QUALITY = 0.85
const CAPTURE_DIR_NAME = 'fint-capture'
const STALE_FILE_MAX_AGE_MS = 60 * 60 * 1000

export type PreparedImage = {
  uri: string
  base64: string
  cleanup: () => void
}

function captureDirectory(): Directory {
  const dir = new Directory(Paths.cache, CAPTURE_DIR_NAME)
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

function deleteIfExists(file: File): void {
  try {
    if (file.exists) file.delete()
  } catch {
    // Best-effort: un archivo que no se puede borrar no debe tumbar el flujo de captura.
  }
}

/**
 * Regla 2: content:// (y ph://) se copian de inmediato a un archivo con
 * nombre generado por nosotros — nunca el displayName que reporta el content
 * provider. `file://` ya bajo nuestras carpetas no se copia de nuevo.
 */
function ensureSandboxCopy(uri: string): { file: File; owned: boolean } {
  if (uri.startsWith('file://')) return { file: new File(uri), owned: false }
  const dest = new File(captureDirectory(), `${randomId()}.bin`)
  new File(uri).copy(dest)
  return { file: dest, owned: true }
}

function assertRecognizedFormat(file: File): void {
  const handle = file.open()
  try {
    const header = handle.readBytes(32)
    if (!isRecognizedImageHeader(header)) {
      throw new CaptureRejectedError('unrecognized_format', 'La imagen no tiene una firma binaria reconocida')
    }
  } finally {
    handle.close()
  }
}

function probeImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    )
  })
}

/**
 * Regla 5 + regla 6 (mitad 2): re-codificación obligatoria — fuerza
 * decodificación real (un ejecutable renombrado muere aquí), elimina
 * EXIF/GPS y neutraliza polyglots — envuelta en un timeout porque incluso
 * con las dimensiones ya validadas, decodificar puede colgarse.
 */
async function recodeImage(uri: string, sourceWidth: number): Promise<{ uri: string; base64: string }> {
  const recode = (async () => {
    const context = ImageManipulator.manipulate(uri)
    if (sourceWidth > TARGET_WIDTH) context.resize({ width: TARGET_WIDTH })
    const rendered = await context.renderAsync()
    const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true })
    if (!saved.base64) throw new CaptureRejectedError('processing_failed', 'La recodificación no devolvió base64')
    return { uri: saved.uri, base64: saved.base64 }
  })()

  const timeout = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new CaptureRejectedError('processing_timeout', 'La recodificación tardó demasiado')), RECODE_TIMEOUT_MS)
  })

  return Promise.race([recode, timeout])
}

/**
 * Punto de entrada único del pipeline. Sanitiza, copia a sandbox si hace
 * falta, valida tamaño y firma, valida dimensiones, y re-codifica. Solo el
 * archivo re-codificado que devuelve se sube — nunca el original.
 */
export async function prepareImageForOcr(rawUri: string): Promise<PreparedImage> {
  assertUriAllowed(rawUri, Paths.cache.uri, Paths.document.uri)

  const { file: sourceFile, owned } = ensureSandboxCopy(rawUri)
  try {
    assertSizeWithinLimit(sourceFile.size)
    assertRecognizedFormat(sourceFile)

    const { width, height } = await probeImageSize(sourceFile.uri)
    assertSafeDimensions(width, height)

    const recoded = await recodeImage(sourceFile.uri, width)
    return {
      uri: recoded.uri,
      base64: recoded.base64,
      cleanup: () => deleteIfExists(new File(recoded.uri)),
    }
  } finally {
    if (owned) deleteIfExists(sourceFile)
  }
}

/**
 * Regla 7: barrido de restos por si un crash saltó el cleanup() del llamador.
 * Pensado para llamarse al montar la pantalla de captura, no en cada imagen.
 */
export function sweepStaleCaptureFiles(maxAgeMs: number = STALE_FILE_MAX_AGE_MS): void {
  const dir = new Directory(Paths.cache, CAPTURE_DIR_NAME)
  if (!dir.exists) return
  const now = Date.now()
  for (const entry of dir.list()) {
    if (entry instanceof Directory) continue
    const modified = entry.modificationTime
    if (modified !== null && now - modified > maxAgeMs) deleteIfExists(entry)
  }
}
