import { structureText } from './heuristics'
import type { RecipeRecognizer } from './types'

const LABELS: Record<string, string> = {
  'loading tesseract core': 'Carico il motore di lettura (solo la prima volta)…',
  'loading language traineddata': 'Carico la lingua italiana (solo la prima volta)…',
  'initializing api': 'Preparo la lettura…',
}

/**
 * OCR locale con Tesseract.js, lingua italiana. Gira tutto sul dispositivo; i file (motore e lingua)
 * sono serviti dall'app stessa (public/ocr) e la libreria è caricata solo quando serve.
 * Non adatto allo scritto a mano.
 */
export const ocrRecognizer: RecipeRecognizer = {
  name: 'OCR locale',
  async recognize(images, options = {}) {
    const { createWorker } = await import('tesseract.js')
    const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href
    let page = 0
    const total = Math.max(1, images.length)
    const worker = await createWorker('ita', 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      gzip: true,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          options.onProgress?.((page + m.progress) / total, total > 1 ? `Leggo la pagina ${page + 1} di ${total}…` : 'Leggo il testo…')
        } else if (LABELS[m.status]) options.onProgress?.(0, LABELS[m.status])
      },
    })
    try {
      const texts: string[] = []
      for (page = 0; page < images.length; page++) {
        if (options.signal?.aborted) throw new DOMException('Annullato', 'AbortError')
        const { data } = await worker.recognize(images[page])
        texts.push(data.text)
      }
      options.onProgress?.(1, 'Fatto')
      return structureText(texts.join('\n\n'))
    } finally {
      await worker.terminate()
    }
  },
}
