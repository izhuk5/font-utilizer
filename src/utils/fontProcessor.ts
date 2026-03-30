// @ts-ignore - fonteditor-core has partial types
import { Font, woff2 } from 'fonteditor-core'

const woff2WasmUrl = '/woff2.wasm'

export const DEFAULT_CHARSET =
  `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.-'?!$#"'""''«»„`

export interface SubsetResult {
  originalSize: number
  subsetSize: number
  woff2Size: number
  glyphCount: number
  fontName: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let woff2InitPromise: Promise<any> | null = null

function ensureWoff2() {
  if (!woff2InitPromise) {
    woff2InitPromise = woff2.init(woff2WasmUrl)
  }
  return woff2InitPromise
}

// Kick off WASM loading immediately so it's ready when the user clicks
ensureWoff2()

function getSubsetCodepoints(characters: string): number[] {
  return [...new Set(characters)].map((c) => c.codePointAt(0)!).filter(Boolean)
}

function detectFontType(buffer: ArrayBuffer): 'ttf' | 'otf' | 'woff' | 'woff2' {
  const view = new Uint8Array(buffer, 0, 4)
  const tag = String.fromCharCode(view[0], view[1], view[2], view[3])
  if (tag === 'wOF2') return 'woff2'
  if (tag === 'wOFF') return 'woff'
  if (tag === 'OTTO') return 'otf'
  return 'ttf'
}

export async function processFont(
  buffer: ArrayBuffer,
  characters: string,
): Promise<{ woff2Buffer: ArrayBuffer; info: SubsetResult }> {
  await ensureWoff2()

  const subset = getSubsetCodepoints(characters)
  const fontType = detectFontType(buffer)

  const font = Font.create(buffer, {
    type: fontType,
    subset,
    hinting: false,
    kerning: false,
  })

  // Get font name from the original TTF data
  const fontData = font.get()
  const familyName: string = fontData?.name?.fontFamily || 'Subset Font'
  const styleName: string = fontData?.name?.fontSubfamily || 'Regular'

  const subsetTtfBuffer: ArrayBuffer = font.write({ type: 'ttf' })

  // Convert to WOFF2 using the initialized WASM
  const subsetFont2 = Font.create(subsetTtfBuffer, { type: 'ttf' })
  const woff2Buffer: ArrayBuffer = subsetFont2.write({ type: 'woff2' })

  return {
    woff2Buffer,
    info: {
      originalSize: buffer.byteLength,
      subsetSize: subsetTtfBuffer.byteLength,
      woff2Size: woff2Buffer.byteLength,
      glyphCount: subset.length + 1, // +1 for .notdef
      fontName: `${familyName} ${styleName}`,
    },
  }
}

export function downloadFile(data: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function loadFontIntoPage(fontData: ArrayBuffer, fontFamily: string): string {
  const blob = new Blob([fontData], { type: 'font/woff2' })
  const url = URL.createObjectURL(blob)
  const style = document.createElement('style')
  style.textContent = `@font-face { font-family: '${fontFamily}'; src: url('${url}') format('woff2'); }`
  document.head.appendChild(style)
  return url
}
