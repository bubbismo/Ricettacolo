import { describe, expect, it } from 'vitest'
import { contentHash } from './hash'
import { decideMerge } from './merge'
import { defaultFilters, searchRecipes } from './search'
import { emptyContent, normalizeRecipe, type Recipe } from './recipe'
import { migrateRecipe } from './migrations'

const mk = (over: Partial<Recipe> = {}): Recipe =>
  normalizeRecipe({ id: 'a', title: 'Tiramisù', mainIngredients: 'mascarpone, caffè', ...over })

describe('hash', () => {
  it('non dipende dall\'ordine delle categorie né dagli spazi', async () => {
    const a = { ...emptyContent(), title: 'X ', categories: ['b', 'a'], date: '2026-01-01' }
    const b = { ...emptyContent(), title: 'X', categories: ['a', 'b'], date: '2026-01-01' }
    expect(await contentHash(a)).toBe(await contentHash(b))
  })
  it('cambia se cambia una foto o un campo', async () => {
    const a = { ...emptyContent(), date: '2026-01-01', photoIds: ['p1'] }
    expect(await contentHash(a)).not.toBe(await contentHash({ ...a, photoIds: ['p2'] }))
    expect(await contentHash(a)).not.toBe(await contentHash({ ...a, rating: 3 }))
  })
})

describe('merge', () => {
  const t1 = '2026-01-01T00:00:00Z', t2 = '2026-02-01T00:00:00Z'
  it('aggiunge se assente', () => expect(decideMerge(undefined, mk())).toBe('add'))
  it('salta se hash uguale', () =>
    expect(decideMerge(mk({ hash: 'h' }), mk({ hash: 'h', updatedAt: t2 }))).toBe('skip'))
  it('aggiorna se più recente', () =>
    expect(decideMerge(mk({ hash: 'h1', updatedAt: t1 }), mk({ hash: 'h2', updatedAt: t2 }))).toBe('update'))
  it('tiene la locale se più vecchia o a parità', () => {
    expect(decideMerge(mk({ hash: 'h1', updatedAt: t2 }), mk({ hash: 'h2', updatedAt: t1 }))).toBe('skip')
    expect(decideMerge(mk({ hash: 'h1', updatedAt: t1 }), mk({ hash: 'h2', updatedAt: t1 }))).toBe('skip')
  })
})

describe('ricerca', () => {
  const list = [
    mk({ id: '1', title: 'Tiramisù', rating: 5, favorite: true, lastCookedAt: '2026-03-01' }),
    mk({ id: '2', title: 'Lasagne', source: 'nonna Maria', mainIngredients: 'ragù, besciamella', categories: ['Primi'] }),
    mk({ id: '3', title: 'Pizza', ocrText: 'farina lievito', rating: 3 }),
  ]
  it('ignora accenti e maiuscole, cerca in tutti i campi', () => {
    expect(searchRecipes(list, { ...defaultFilters(), query: 'TIRAMISU' }).map((r) => r.id)).toEqual(['1'])
    expect(searchRecipes(list, { ...defaultFilters(), query: 'nonna besciamella' }).map((r) => r.id)).toEqual(['2'])
    expect(searchRecipes(list, { ...defaultFilters(), query: 'lievito' }).map((r) => r.id)).toEqual(['3'])
  })
  it('filtra e ordina', () => {
    expect(searchRecipes(list, { ...defaultFilters(), category: 'Primi' }).map((r) => r.id)).toEqual(['2'])
    expect(searchRecipes(list, { ...defaultFilters(), minRating: 4 }).map((r) => r.id)).toEqual(['1'])
    expect(searchRecipes(list, { ...defaultFilters(), cooked: 'never' }).map((r) => r.id)).toEqual(['2', '3'])
    expect(searchRecipes(list, { ...defaultFilters(), sort: 'rating' }).map((r) => r.id)).toEqual(['1', '3', '2'])
  })
})

describe('migrazioni', () => {
  it('legge record parziali senza perdere campi', () => {
    const r = migrateRecipe({ id: 'x', title: 'Vecchia', rating: 4, foo: 1 })!
    expect(r.title).toBe('Vecchia')
    expect(r.rating).toBe(4)
    expect(r.photoIds).toEqual([])
  })
  it('scarta record senza id', () => expect(migrateRecipe({ title: 'no' })).toBeNull())
})
