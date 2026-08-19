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

export const MAX_SOURCE_BYTES = 12 * 1024 * 1024
export const MAX_PIXELS = 40_000_000
export const MAX_ASPECT_RATIO = 20

function withTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`
}

// startsWith a secas confundiría "cache-evil/" con un subdirectorio de "cache/" —
// el slash final es lo que garantiza que sea de verdad un descendiente.
function isUnderDirectory(uri: string, directoryUri: string): boolean {
  return uri.startsWith(withTrailingSlash(directoryUri))
}

/**
 * Regla 1: allowlist de esquemas. Todo lo que no está explícitamente
 * permitido se rechaza — nunca al revés. `content://` y `ph://` se copian al
 * sandbox después; `file://` solo se acepta bajo nuestras propias carpetas
 * (pasadas como parámetro, no leídas de Paths, para que esto sea testeable
 * sin expo-file-system).
 */
export function assertUriAllowed(uri: string, cacheUri: string, documentUri: string): void {
  let decoded: string
  try {
    decoded = decodeURIComponent(uri)
  } catch {
    throw new CaptureRejectedError('uri_not_allowed', 'URI con percent-encoding inválido')
  }
  if (decoded.includes('..')) throw new CaptureRejectedError('uri_not_allowed', 'URI con path traversal')

  if (uri.startsWith('content://') || uri.startsWith('ph://')) return
  if (uri.startsWith('file://') && (isUnderDirectory(uri, cacheUri) || isUnderDirectory(uri, documentUri))) return

  throw new CaptureRejectedError('uri_not_allowed', `Esquema de URI no permitido: ${uri.split(':')[0]}`)
}

// Regla 3: tamaño antes de leer contenido.
export function assertSizeWithinLimit(sizeBytes: number): void {
  if (sizeBytes > MAX_SOURCE_BYTES) {
    throw new CaptureRejectedError('file_too_large', `${sizeBytes} bytes excede el máximo de ${MAX_SOURCE_BYTES}`)
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

// Regla 4: firma binaria, nunca extensión ni mimeType — esos los controla
// quien nos entrega la imagen, la firma no.
export function isRecognizedImageHeader(bytes: Uint8Array): boolean {
  if (startsWithBytes(bytes, JPEG_MAGIC)) return true
  if (startsWithBytes(bytes, PNG_MAGIC)) return true
  if (readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP') return true
  if (readAscii(bytes, 4, 4) === 'ftyp' && HEIC_BRANDS.has(readAscii(bytes, 8, 4))) return true
  return false
}

// Regla 6 (mitad 1): dimensiones declaradas antes de forzar la decodificación
// completa en el paso de recodificación.
export function assertSafeDimensions(width: number, height: number): void {
  if (!(width > 0) || !(height > 0)) throw new CaptureRejectedError('decompression_bomb', 'Dimensiones inválidas')
  if (width * height > MAX_PIXELS) throw new CaptureRejectedError('decompression_bomb', `${width}x${height} excede ${MAX_PIXELS} px`)
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > MAX_ASPECT_RATIO) throw new CaptureRejectedError('decompression_bomb', `Relación de aspecto ${ratio.toFixed(1)}:1 excede ${MAX_ASPECT_RATIO}:1`)
}
