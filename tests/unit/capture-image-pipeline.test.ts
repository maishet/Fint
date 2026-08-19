import { describe, expect, test } from 'bun:test'
import {
  assertSafeDimensions,
  assertSizeWithinLimit,
  assertUriAllowed,
  CaptureRejectedError,
  isRecognizedImageHeader,
  MAX_ASPECT_RATIO,
  MAX_PIXELS,
  MAX_SOURCE_BYTES,
} from '../../src/capture/image-validation'

const CACHE_URI = 'file:///data/user/0/com.fint.finanzasmobilev2/cache/'
const DOCUMENT_URI = 'file:///data/user/0/com.fint.finanzasmobilev2/files/'

function reasonOf(fn: () => void): string | undefined {
  try {
    fn()
    return undefined
  } catch (error) {
    return error instanceof CaptureRejectedError ? error.reasonCode : undefined
  }
}

describe('assertUriAllowed', () => {
  test('acepta content:// y ph:// sin importar el resto de la ruta', () => {
    expect(() => assertUriAllowed('content://media/external/images/42', CACHE_URI, DOCUMENT_URI)).not.toThrow()
    expect(() => assertUriAllowed('ph://ABCD-1234', CACHE_URI, DOCUMENT_URI)).not.toThrow()
  })

  test('acepta file:// bajo cache o document', () => {
    expect(() => assertUriAllowed(`${CACHE_URI}fint-capture/x.bin`, CACHE_URI, DOCUMENT_URI)).not.toThrow()
    expect(() => assertUriAllowed(`${DOCUMENT_URI}x.bin`, CACHE_URI, DOCUMENT_URI)).not.toThrow()
  })

  test('rechaza esquemas fuera de la allowlist: http(s), data:, android.resource:, javascript:', () => {
    expect(reasonOf(() => assertUriAllowed('https://evil.example/x.jpg', CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
    expect(reasonOf(() => assertUriAllowed('data:image/png;base64,AAAA', CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
    expect(reasonOf(() => assertUriAllowed('android.resource://com.evil/x', CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
    expect(reasonOf(() => assertUriAllowed('javascript:alert(1)', CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
  })

  test('rechaza file:// fuera de cache/document, incluso un directorio hermano con nombre parecido', () => {
    // "cache-evil/" no es un subdirectorio real de ".../cache/" — un startsWith
    // a secas lo confundiría; el slash final en la comparación lo evita.
    expect(reasonOf(() => assertUriAllowed('file:///data/user/0/com.fint.finanzasmobilev2/cache-evil/x', CACHE_URI, DOCUMENT_URI))).toBe(
      'uri_not_allowed',
    )
    expect(reasonOf(() => assertUriAllowed('file:///etc/passwd', CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
  })

  test('rechaza path traversal tras decodificar percent-encoding', () => {
    expect(reasonOf(() => assertUriAllowed(`${CACHE_URI}..%2f..%2fetc%2fpasswd`, CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
    expect(reasonOf(() => assertUriAllowed(`${CACHE_URI}../../etc/passwd`, CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
  })

  test('percent-encoding malformado se rechaza en vez de lanzar una excepción sin capturar', () => {
    expect(reasonOf(() => assertUriAllowed(`${CACHE_URI}%`, CACHE_URI, DOCUMENT_URI))).toBe('uri_not_allowed')
  })
})

describe('assertSizeWithinLimit', () => {
  test('acepta hasta el máximo (12 MB)', () => {
    expect(() => assertSizeWithinLimit(MAX_SOURCE_BYTES)).not.toThrow()
  })

  test('rechaza un byte por encima del máximo', () => {
    expect(reasonOf(() => assertSizeWithinLimit(MAX_SOURCE_BYTES + 1))).toBe('file_too_large')
  })
})

describe('isRecognizedImageHeader — firma binaria, no extensión ni mimeType', () => {
  test('acepta JPEG', () => {
    expect(isRecognizedImageHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe(true)
  })

  test('acepta PNG', () => {
    expect(isRecognizedImageHeader(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true)
  })

  test('acepta WEBP (RIFF....WEBP)', () => {
    const bytes = new Uint8Array(12)
    bytes.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
    bytes.set([0, 0, 0, 0], 4) // tamaño, irrelevante para la firma
    bytes.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP
    expect(isRecognizedImageHeader(bytes)).toBe(true)
  })

  test('acepta HEIC/HEIF por su brand ftyp', () => {
    for (const brand of ['heic', 'heix', 'hevc', 'mif1', 'msf1']) {
      const bytes = new Uint8Array(12)
      bytes.set([0, 0, 0, 0x20], 0)
      bytes.set([0x66, 0x74, 0x79, 0x70], 4) // ftyp
      bytes.set([...brand].map((c) => c.charCodeAt(0)), 8)
      expect(isRecognizedImageHeader(bytes)).toBe(true)
    }
  })

  test('rechaza un PDF renombrado a .jpg', () => {
    expect(isRecognizedImageHeader(new TextEncoder().encode('%PDF-1.4'))).toBe(false)
  })

  test('rechaza un ZIP (también cubre .docx/.apk disfrazados)', () => {
    expect(isRecognizedImageHeader(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false)
  })

  test('rechaza un ejecutable ELF', () => {
    expect(isRecognizedImageHeader(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]))).toBe(false)
  })

  test('rechaza SVG (es texto, no un binario de imagen)', () => {
    expect(isRecognizedImageHeader(new TextEncoder().encode('<svg xmlns='))).toBe(false)
  })

  test('rechaza <?php', () => {
    expect(isRecognizedImageHeader(new TextEncoder().encode('<?php system($_GET[0]); ?>'))).toBe(false)
  })

  test('un buffer más corto que la firma no revienta, solo se rechaza', () => {
    expect(isRecognizedImageHeader(new Uint8Array([0xff, 0xd8]))).toBe(false)
    expect(isRecognizedImageHeader(new Uint8Array())).toBe(false)
  })
})

describe('assertSafeDimensions — bomba de descompresión', () => {
  test('acepta dimensiones típicas de una foto de recibo', () => {
    expect(() => assertSafeDimensions(1600, 1200)).not.toThrow()
  })

  test('acepta justo en el límite de píxeles con ratio seguro', () => {
    expect(() => assertSafeDimensions(8000, 5000)).not.toThrow() // 40,000,000 px exacto
  })

  test('rechaza por exceder el máximo de píxeles', () => {
    expect(reasonOf(() => assertSafeDimensions(Math.floor(Math.sqrt(MAX_PIXELS)) + 100, Math.floor(Math.sqrt(MAX_PIXELS)) + 100))).toBe(
      'decompression_bomb',
    )
  })

  test('rechaza por relación de aspecto extrema aunque los píxeles totales sean pocos', () => {
    expect(reasonOf(() => assertSafeDimensions(10000, 10000 / (MAX_ASPECT_RATIO + 1)))).toBe('decompression_bomb')
  })

  test('rechaza dimensiones inválidas (cero o negativas)', () => {
    expect(reasonOf(() => assertSafeDimensions(0, 100))).toBe('decompression_bomb')
    expect(reasonOf(() => assertSafeDimensions(100, -1))).toBe('decompression_bomb')
  })
})
