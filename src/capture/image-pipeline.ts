import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { Image as RNImage } from 'react-native'
import { randomId } from '../shared/id'

export const MAX_CAPTURE_BATCH_SIZE = 5

const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_PIXELS = 40_000_000
const MAX_ASPECT_RATIO = 20
const RECODE_TIMEOUT_MS = 8_000
const TARGET_WIDTH = 1600
const JPEG_QUALITY = 0.85
const CAPTURE_DIR_NAME = 'fint-capture'
const STALE_FILE_MAX_AGE_MS = 60 * 60 * 1000

export type CaptureRejectReason =
  | 'uri_not_allowed'
  | 'file_too_large'
  | 'unrecognized_format'
  | 'decompression_bomb'
  | 'processing_timeout'
  | 'processing_failed'

export class CaptureRejectedError extends Error {
  constructor(
    public readonly reasonCode: CaptureRejectReason,
    message: string,
  ) {
    super(message)
    this.name = 'CaptureRejectedError'
  }
}

export type PreparedImage = {
  uri: string
  base64: string
  cleanup: () => void
}

function withTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`
}

function isUnderDirectory(uri: string, directoryUri: string): boolean {
  return uri.startsWith(withTrailingSlash(directoryUri))
}

function assertUriAllowed(uri: string): void {
  let decoded: string
  try {
    decoded = decodeURIComponent(uri)
  } catch {
    throw new CaptureRejectedError('uri_not_allowed', 'URI con percent-encoding inválido')
  }
  if (decoded.includes('..')) throw new CaptureRejectedError('uri_not_allowed', 'URI con path traversal')

  if (uri.startsWith('content://') || uri.startsWith('ph://')) return
  if (uri.startsWith('file://') && (isUnderDirectory(uri, Paths.cache.uri) || isUnderDirectory(uri, Paths.document.uri))) return

  throw new CaptureRejectedError('uri_not_allowed', `Esquema de URI no permitido: ${uri.split(':')[0]}`)
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

function ensureSandboxCopy(uri: string): { file: File; owned: boolean } {
  if (uri.startsWith('file://')) return { file: new File(uri), owned: false }
  const dest = new File(captureDirectory(), `${randomId()}.bin`)
  new File(uri).copy(dest)
  return { file: dest, owned: true }
}

function assertSizeWithinLimit(file: File): void {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new CaptureRejectedError('file_too_large', `${file.size} bytes excede el máximo de ${MAX_SOURCE_BYTES}`)
  }
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'mif1', 'msf1'])

function startsWithBytes(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((value, index) => bytes[index] === value)
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return ''
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function isRecognizedImageHeader(bytes: Uint8Array): boolean {
  if (startsWithBytes(bytes, JPEG_MAGIC)) return true
  if (startsWithBytes(bytes, PNG_MAGIC)) return true
  if (readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP') return true
  if (readAscii(bytes, 4, 4) === 'ftyp' && HEIC_BRANDS.has(readAscii(bytes, 8, 4))) return true
  return false
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

function assertSafeDimensions(width: number, height: number): void {
  if (!(width > 0) || !(height > 0)) throw new CaptureRejectedError('decompression_bomb', 'Dimensiones inválidas')
  if (width * height > MAX_PIXELS) throw new CaptureRejectedError('decompression_bomb', `${width}x${height} excede ${MAX_PIXELS} px`)
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > MAX_ASPECT_RATIO) throw new CaptureRejectedError('decompression_bomb', `Relación de aspecto ${ratio.toFixed(1)}:1 excede ${MAX_ASPECT_RATIO}:1`)
}

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

export async function prepareImageForOcr(rawUri: string): Promise<PreparedImage> {
  assertUriAllowed(rawUri)

  const { file: sourceFile, owned } = ensureSandboxCopy(rawUri)
  try {
    assertSizeWithinLimit(sourceFile)
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
