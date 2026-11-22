import type { Recipe } from '../../core/recipe'
import { formatDate } from '../../core/recipe'

export interface PdfPhoto { bytes: Uint8Array; width: number; height: number }
export interface PdfRecipe { recipe: Recipe; photos: PdfPhoto[] }

const PAGE_W = 210, PAGE_H = 297, MARGIN = 14
/** le foto si fermano sopra il piè di pagina con il marchio */
const BOTTOM = PAGE_H - 20
const INDEX_ROWS = 40

type Doc = InstanceType<typeof import('jspdf').jsPDF>

/** Spezza una stringa senza spazi (un indirizzo web) in righe che stanno nella larghezza data. */
function breakLong(doc: Doc, text: string, width: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    if (doc.getTextWidth(cur + ch) > width && cur) { lines.push(cur); cur = '' }
    cur += ch
  }
  if (cur) lines.push(cur)
  return lines
}

function drawRecipe(doc: Doc, { recipe: r, photos }: PdfRecipe) {
  let y = MARGIN + 6
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(60, 36, 20)
  for (const line of doc.splitTextToSize(r.title || 'Senza titolo', PAGE_W - 2 * MARGIN) as string[]) {
    doc.text(line, MARGIN, y)
    y += 9
  }

  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(80, 60, 45)
  const rows: [string, string][] = []
  if (r.source) rows.push(['Da', r.source])
  if (r.link) rows.push(['Link', r.link])
  rows.push(['Data', formatDate(r.date)])
  if (r.categories.length) rows.push(['Categorie', r.categories.join(', ')])
  if (r.rating) rows.push(['Voto', `${r.rating} su 5`])
  if (r.mainIngredients) rows.push(['Ingredienti', r.mainIngredients])
  if (r.notes) rows.push(['Note', r.notes])
  if (r.lastCookedAt) rows.push(['Ultima volta cucinata', formatDate(r.lastCookedAt)])
  for (const [k, v] of rows) {
    const label = `${k}: `
    doc.setFont('helvetica', 'bold')
    const lw = doc.getTextWidth(label)
    doc.text(label, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    const isLink = k === 'Link'
    const lines = isLink ? breakLong(doc, v, PAGE_W - 2 * MARGIN - lw) : (doc.splitTextToSize(v, PAGE_W - 2 * MARGIN - lw) as string[])
    lines.forEach((l, i) => { doc.text(l, MARGIN + lw, y + i * 5) })
    // stampato come testo, e in più cliccabile dove il lettore PDF lo permette
    if (isLink) doc.link(MARGIN + lw, y - 4, PAGE_W - 2 * MARGIN - lw, lines.length * 5, { url: v })
    y += lines.length * 5 + 1.5
  }
  y += 2

  photos.forEach((p, i) => {
    // la prima foto sta sotto l'intestazione se c'è spazio sufficiente, le altre hanno una pagina intera
    if (i > 0 || BOTTOM - y < 110) {
      if (i > 0 || y > MARGIN + 20) { doc.addPage(); y = MARGIN }
    }
    const maxW = PAGE_W - 2 * MARGIN, maxH = BOTTOM - y
    const k = Math.min(maxW / p.width, maxH / p.height)
    const w = p.width * k, h = p.height * k
    doc.addImage(p.bytes, 'JPEG', MARGIN + (maxW - w) / 2, y, w, h, undefined, 'FAST')
    y = PAGE_H // la foto successiva va su una nuova pagina
  })
}

function drawIndex(doc: Doc, items: PdfRecipe[], startPages: number[], indexPages: number, logo?: Uint8Array) {
  for (let p = 0; p < indexPages; p++) {
    doc.setPage(p + 1)
    let y = MARGIN + 6
    if (p === 0) {
      const tx = logo ? MARGIN + 22 : MARGIN
      if (logo) doc.addImage(logo, 'PNG', MARGIN, y - 9, 18, 18)
      doc.setFont('helvetica', 'bold').setFontSize(26).setTextColor(60, 36, 20)
      doc.text('Ricettacolo', tx, y)
      doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(120, 100, 85)
      doc.text(`Ricettario · ${items.length} ricette · ${formatDate(new Date().toISOString().slice(0, 10))}`, tx, y + 7)
      y += 22
    }
    doc.setFontSize(11).setTextColor(60, 36, 20)
    items.slice(p * INDEX_ROWS, (p + 1) * INDEX_ROWS).forEach((it, k) => {
      const idx = p * INDEX_ROWS + k
      const title = (doc.splitTextToSize(it.recipe.title || 'Senza titolo', PAGE_W - 2 * MARGIN - 20) as string[])[0]
      doc.text(title, MARGIN, y)
      doc.text(String(startPages[idx]), PAGE_W - MARGIN, y, { align: 'right' })
      y += 6
    })
  }
}

/**
 * Impagina una o più ricette: intestazione con i metadati e le foto in ordine, ogni pagina il più grande possibile.
 * Con più ricette aggiunge un indice con i numeri di pagina.
 */
export async function buildPdf(
  items: PdfRecipe[],
  opts: { onProgress?: (done: number, total: number) => void; /** icona PNG dell'app, per il marchio su ogni pagina */ logo?: Uint8Array } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf') // caricato solo quando serve
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const multi = items.length > 1
  const indexPages = multi ? Math.ceil(items.length / INDEX_ROWS) : 0
  for (let i = 1; i < indexPages; i++) doc.addPage()

  const startPages: number[] = []
  for (const [i, item] of items.entries()) {
    if (multi || i > 0) doc.addPage()
    startPages.push(doc.getNumberOfPages())
    drawRecipe(doc, item)
    opts.onProgress?.(i + 1, items.length)
    await new Promise((r) => setTimeout(r)) // lascia respirare l'interfaccia
  }
  if (multi) drawIndex(doc, items, startPages, indexPages, opts.logo)

  // piè di pagina su ogni pagina: icona + nome dell'app a sinistra, numero di pagina a destra
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    const base = PAGE_H - 9
    let tx = MARGIN
    if (opts.logo) { doc.addImage(opts.logo, 'PNG', MARGIN, base - 6, 8, 8); tx += 10.5 }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(90, 42, 20)
    doc.text('Ricettacolo', tx, base)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(150, 130, 115)
    doc.text(String(p), PAGE_W - MARGIN, base, { align: 'right' })
  }
  return doc.output('blob')
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

export function pdfFileName(items: Recipe[], now = new Date()): string {
  if (items.length === 1) return `${slug(items[0].title) || 'ricetta'}.pdf`
  return `ricettario-${now.toISOString().slice(0, 10)}.pdf`
}
