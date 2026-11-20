import type { Recipe } from '../../core/recipe'
import { formatDate } from '../../core/recipe'

export interface PdfPhoto { bytes: Uint8Array; width: number; height: number }
export interface PdfRecipe { recipe: Recipe; photos: PdfPhoto[] }

const PAGE_W = 210, PAGE_H = 297, MARGIN = 14

/** Impagina una o più ricette: intestazione con i metadati e le foto in ordine, ogni pagina il più grande possibile. */
export async function buildPdf(items: PdfRecipe[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf') // caricato solo quando serve
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let first = true

  for (const { recipe: r, photos } of items) {
    if (!first) doc.addPage()
    first = false
    let y = MARGIN + 6

    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(60, 36, 20)
    for (const line of doc.splitTextToSize(r.title || 'Senza titolo', PAGE_W - 2 * MARGIN) as string[]) {
      doc.text(line, MARGIN, y)
      y += 9
    }

    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(80, 60, 45)
    const rows: [string, string][] = []
    if (r.source) rows.push(['Da', r.source])
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
      const lines = doc.splitTextToSize(v, PAGE_W - 2 * MARGIN - lw) as string[]
      lines.forEach((l, i) => { doc.text(l, MARGIN + lw, y + i * 5) })
      y += lines.length * 5 + 1.5
    }
    y += 2

    photos.forEach((p, i) => {
      // la prima foto sta sotto l'intestazione se c'è spazio sufficiente, le altre hanno una pagina intera
      if (i > 0 || PAGE_H - MARGIN - y < 110) {
        if (i > 0 || y > MARGIN + 20) { doc.addPage(); y = MARGIN }
      }
      const maxW = PAGE_W - 2 * MARGIN, maxH = PAGE_H - MARGIN - y
      const k = Math.min(maxW / p.width, maxH / p.height)
      const w = p.width * k, h = p.height * k
      doc.addImage(p.bytes, 'JPEG', MARGIN + (maxW - w) / 2, y, w, h, undefined, 'FAST')
      y = PAGE_H // la foto successiva va su una nuova pagina
    })
  }
  return doc.output('blob')
}

export function pdfFileName(items: Recipe[]): string {
  const base = items.length === 1 ? (items[0].title || 'ricetta') : 'ricette'
  const slug = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${slug || 'ricetta'}.pdf`
}
