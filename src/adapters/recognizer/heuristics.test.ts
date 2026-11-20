import { describe, expect, it } from 'vitest'
import { structureText } from './heuristics'

describe('structureText', () => {
  it('riconosce titolo, ingredienti e procedimento', () => {
    const r = structureText(`TIRAMISÙ

Ingredienti:
- 500 g mascarpone
- 4 uova
• 300 g savoiardi

Procedimento
Montare i tuorli con lo zucchero.
Aggiungere il mascarpone.`)
    expect(r.title).toBe('Tiramisù')
    expect(r.ingredients).toBe('500 g mascarpone, 4 uova, 300 g savoiardi')
    expect(r.steps).toBe('Montare i tuorli con lo zucchero.\nAggiungere il mascarpone.')
  })
  it('senza intestazioni non inventa ingredienti né procedimento', () => {
    const r = structureText('Torta della nonna\nmescolare tutto e infornare')
    expect(r.title).toBe('Torta della nonna')
    expect(r.ingredients).toBeUndefined()
    expect(r.steps).toBeUndefined()
    expect(r.rawText).toContain('infornare')
  })
  it('testo vuoto', () => {
    expect(structureText('  \n ').title).toBeUndefined()
  })
})
