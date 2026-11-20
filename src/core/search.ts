import type { Recipe } from './recipe'

export type CookedFilter = 'all' | 'tried' | 'never'
export type SortKey = 'title' | 'date' | 'rating' | 'cooked'

export interface Filters {
  query: string
  category: string | null
  minRating: number
  favoritesOnly: boolean
  cooked: CookedFilter
  sort: SortKey
}

export const defaultFilters = (): Filters => ({
  query: '', category: null, minRating: 0, favoritesOnly: false, cooked: 'all', sort: 'title',
})

export const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function haystack(r: Recipe): string {
  return fold([r.title, r.source, r.mainIngredients, r.notes, r.ocrText ?? ''].join(' \n '))
}

export function matches(r: Recipe, f: Filters): boolean {
  if (f.category && !r.categories.includes(f.category)) return false
  if (f.minRating > 0 && (r.rating ?? 0) < f.minRating) return false
  if (f.favoritesOnly && !r.favorite) return false
  if (f.cooked === 'tried' && !r.lastCookedAt) return false
  if (f.cooked === 'never' && r.lastCookedAt) return false
  const terms = fold(f.query).split(/\s+/).filter(Boolean)
  if (terms.length) {
    const h = haystack(r)
    if (!terms.every((t) => h.includes(t))) return false
  }
  return true
}

export function sortRecipes(list: Recipe[], key: SortKey): Recipe[] {
  const byTitle = (a: Recipe, b: Recipe) => a.title.localeCompare(b.title, 'it', { sensitivity: 'base' })
  const arr = [...list]
  switch (key) {
    case 'title': return arr.sort(byTitle)
    case 'date': return arr.sort((a, b) => b.date.localeCompare(a.date) || byTitle(a, b))
    case 'rating': return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b))
    case 'cooked': return arr.sort((a, b) => (b.lastCookedAt ?? '').localeCompare(a.lastCookedAt ?? '') || byTitle(a, b))
  }
}

export function searchRecipes(all: Recipe[], f: Filters): Recipe[] {
  return sortRecipes(all.filter((r) => matches(r, f)), f.sort)
}
