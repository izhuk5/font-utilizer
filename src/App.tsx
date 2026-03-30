import { useState, useCallback, useRef } from 'react'
import {
  DEFAULT_CHARSET,
  processFont,
  downloadFile,
  loadFontIntoPage,
  type SubsetResult,
} from './utils/fontProcessor'

type Step = 'idle' | 'processing' | 'done' | 'error'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-center ${
        accent
          ? 'border-emerald-800/60 bg-emerald-950/40'
          : 'border-zinc-800 bg-zinc-950'
      }`}
    >
      <span className="mb-1 block text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </span>
      <span
        className={`block text-sm font-semibold ${accent ? 'text-emerald-400 text-base' : 'text-zinc-100'}`}
      >
        {value}
      </span>
    </div>
  )
}

export default function App() {
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState('')
  const [charset, setCharset] = useState(DEFAULT_CHARSET)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')
  const [info, setInfo] = useState<SubsetResult | null>(null)
  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(null)
  const [woff2Data, setWoff2Data] = useState<ArrayBuffer | null>(null)
  const [previewText, setPreviewText] = useState('Hello World! Abc 123')
  const [isDragging, setIsDragging] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setFontBuffer(e.target?.result as ArrayBuffer)
      setFileName(file.name)
      setStep('idle')
      setInfo(null)
      setWoff2Data(null)
      setPreviewFontFamily(null)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleProcess = useCallback(async () => {
    if (!fontBuffer || !charset.trim()) return
    setStep('processing')
    setError('')
    try {
      const { woff2Buffer, info: subsetInfo } = await processFont(fontBuffer, charset)

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = loadFontIntoPage(woff2Buffer, '__preview_font__')

      setInfo(subsetInfo)
      setWoff2Data(woff2Buffer)
      setPreviewFontFamily('__preview_font__')
      setStep('done')
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }, [fontBuffer, charset])

  const handleDownload = useCallback(() => {
    if (!woff2Data) return
    const baseName = fileName.replace(/\.(ttf|otf|woff2?)$/i, '')
    downloadFile(woff2Data, `${baseName}-subset.woff2`, 'font/woff2')
  }, [woff2Data, fileName])

  const reduction = info ? Math.round((1 - info.woff2Size / info.originalSize) * 100) : 0

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      <div className="mx-auto max-w-2xl px-5 pb-20 pt-14">

        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Font Optimizer</h1>
          <p className="text-sm text-zinc-500">
            Subset your font to only the characters you need — export as WOFF2
          </p>
        </header>

        <div className="flex flex-col gap-4">

          {/* Step 1 — Upload */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              1 · Upload font
            </p>

            <label
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-950/20'
                  : fontBuffer
                    ? 'border-emerald-700 bg-emerald-950/20'
                    : 'border-zinc-700 hover:border-zinc-500'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
            >
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
              {fontBuffer ? (
                <>
                  <span className="text-2xl">✓</span>
                  <span className="text-sm font-medium text-zinc-200">{fileName}</span>
                  <span className="text-xs text-zinc-500">{formatBytes(fontBuffer.byteLength)}</span>
                </>
              ) : (
                <>
                  <span className="text-2xl text-zinc-600">↑</span>
                  <span className="text-sm text-zinc-400">Drop TTF / OTF / WOFF / WOFF2 here</span>
                  <span className="text-xs text-zinc-600">or click to browse</span>
                </>
              )}
            </label>
          </section>

          {/* Step 2 — Charset */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                2 · Character set
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-600">
                  {new Set(charset).size} unique chars
                </span>
                <button
                  onClick={() => setCharset(DEFAULT_CHARSET)}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
                >
                  Reset
                </button>
              </div>
            </div>
            <textarea
              value={charset}
              onChange={(e) => setCharset(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-3 font-mono text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-500"
            />
          </section>

          {/* Process button */}
          <button
            disabled={!fontBuffer || !charset.trim() || step === 'processing'}
            onClick={handleProcess}
            className="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {step === 'processing' ? 'Processing…' : 'Optimize & Export'}
          </button>

          {/* Error */}
          {step === 'error' && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Step 3 — Result */}
          {step === 'done' && info && (
            <section className="rounded-2xl border border-emerald-800/40 bg-zinc-900 p-5">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                3 · Result
              </p>

              <div className="mb-5 grid grid-cols-5 gap-2">
                <Stat label="Original" value={formatBytes(info.originalSize)} />
                <Stat label="Subset TTF" value={formatBytes(info.subsetSize)} />
                <Stat label="WOFF2" value={formatBytes(info.woff2Size)} />
                <Stat label="Saved" value={`${reduction}%`} accent />
                <Stat label="Glyphs" value={String(info.glyphCount)} />
              </div>

              {/* Preview */}
              <div className="mb-5">
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-xs text-zinc-500">Preview</span>
                  <input
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-500"
                  />
                </div>
                <div
                  className="min-h-20 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-3xl leading-relaxed break-all text-zinc-100"
                  style={{
                    fontFamily: previewFontFamily
                      ? `'${previewFontFamily}', sans-serif`
                      : undefined,
                  }}
                >
                  {previewText || charset}
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
              >
                Download WOFF2
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
