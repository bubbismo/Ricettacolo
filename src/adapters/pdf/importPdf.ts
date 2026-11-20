import { MAX_SIDE, buildPhoto, makeCanvas } from '../image/process'
import type { NewPhoto } from '../storage/db'

export const isPdf = (f: Blob & { name?: string }): boolean =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name ?? '')

export interface ImportedPdf {
  /** una foto per pagina, già compressa */
  photos: NewPhoto[]
  /** testo del PDF, se contiene testo vero (altrimenti stringa vuota: pagine scansionate) */
  text: string
}

const MAX_PAGES = 60
const MIN_TEXT = 40

/** Legge un PDF: le pagine diventano immagini; se c'è testo vero lo estrae direttamente (niente OCR). Caricato solo quando serve. */
export async function importPdf(file: Blob, onProgress?: (done: number, total: number) => void): Promise<ImportedPdf> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerSrc } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const total = Math.min(doc.numPages, MAX_PAGES)
  const photos: NewPhoto[] = []
  const texts: string[] = []
  try {
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(4, MAX_SIDE / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      const canvas = makeCanvas(Math.round(viewport.width), Math.round(viewport.height))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      photos.push(await buildPhoto(canvas))

      const content = await page.getTextContent()
      texts.push(content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('').replace(/[ \t]+\n/g, '\n').trim())
      page.cleanup()
      onProgress?.(n, total)
    }
  } finally {
    await task.destroy()
  }
  const text = texts.join('\n\n').trim()
  return { photos, text: text.replace(/\s/g, '').length >= MIN_TEXT ? text : '' }
}
