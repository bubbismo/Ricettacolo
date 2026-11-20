import { describe, expect, it } from 'vitest'
import { buildPdf, pdfFileName } from './recipePdf'
import { normalizeRecipe } from '../../core/recipe'

describe('pdf', () => {
  it('crea un PDF valido anche senza foto', async () => {
    const r = normalizeRecipe({ id: 'a', title: 'Tiramisù', notes: 'meno zucchero', rating: 4, categories: ['Dolci'] })
    const blob = await buildPdf([{ recipe: r, photos: [] }])
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5))
    expect(head).toBe('%PDF-')
  })
  it('nome file senza accenti', () => {
    expect(pdfFileName([normalizeRecipe({ id: 'a', title: 'Crème brûlée!' })])).toBe('creme-brulee.pdf')
  })
})
