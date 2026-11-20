// Copia in public/ocr/ i file dell'OCR (motore, lingua italiana, worker) così l'app li serve da sé:
// nessun servizio esterno. Girano solo quando l'OCR viene usato.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'ocr')
mkdirSync(out, { recursive: true })

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/ita/4.0.0_best_int/ita.traineddata.gz', 'ita.traineddata.gz'],
]
for (const [from, to] of files) {
  const src = join(root, from)
  if (!existsSync(src)) throw new Error(`File OCR mancante: ${from} (esegui npm install)`)
  cpSync(src, join(out, to))
}
console.log(`OCR: ${files.length} file copiati in public/ocr`)
