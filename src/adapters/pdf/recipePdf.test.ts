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
  it('stampa anche un link molto lungo senza errori', async () => {
    const r = normalizeRecipe({ id: 'a', title: 'Lunga', link: `https://sito.it/${'percorso-molto-lungo/'.repeat(12)}ricetta` })
    const blob = await buildPdf([{ recipe: r, photos: [] }])
    expect(blob.size).toBeGreaterThan(500)
  })
  it('nome file senza accenti', () => {
    expect(pdfFileName([normalizeRecipe({ id: 'a', title: 'Crème brûlée!' })])).toBe('creme-brulee.pdf')
  })
})
