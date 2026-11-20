import { describe, expect, it } from 'vitest'
import { pickNext } from './pick'
import { normalizeRecipe } from './recipe'

const mk = (id: string, rating: number | null, cats: string[] = []) => normalizeRecipe({ id, title: id, rating: rating as 1, categories: cats })
const all = [mk('a', 5, ['Dolci']), mk('b', 2, ['Primi']), mk('c', 4, ['Dolci'])]

describe('Cosa cucino oggi', () => {
  it('rispetta categoria e voto minimo', () => {
    const r = pickNext(all, { category: 'Dolci', minRating: 5 }, new Set())
    expect(r.recipe?.id).toBe('a')
  })
  it('nessun candidato → null', () => {
    expect(pickNext(all, { category: 'Secondi', minRating: 0 }, new Set()).recipe).toBeNull()
  })
  it('le propone tutte prima di ripetere, poi ricomincia senza ripetere subito l\'ultima', () => {
    let seen = new Set<string>(), last: string | undefined
    const order: string[] = []
    for (let i = 0; i < 3; i++) {
      const r = pickNext(all, { category: null, minRating: 0 }, seen, last, () => 0)
      order.push(r.recipe!.id); seen = r.seen; last = r.recipe!.id
    }
    expect(new Set(order).size).toBe(3)
    const again = pickNext(all, { category: null, minRating: 0 }, seen, last, () => 0)
    expect(again.recipe!.id).not.toBe(last)
  })
})
