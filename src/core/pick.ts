import type { Recipe } from './recipe'

export interface PickOptions { category: string | null; minRating: number }

export function candidates(all: Recipe[], o: PickOptions): Recipe[] {
  return all.filter((r) => (!o.category || r.categories.includes(o.category)) && (r.rating ?? 0) >= o.minRating)
}

/**
 * Una ricetta a caso tra quelle che rispettano i filtri. Prima di ripetere una ricetta le propone tutte
 * (`seen`); quando il giro è finito ricomincia, evitando di ripetere subito l'ultima.
 */
export function pickNext(
  all: Recipe[], o: PickOptions, seen: ReadonlySet<string>, lastId?: string, rng: () => number = Math.random,
): { recipe: Recipe | null; seen: Set<string> } {
  const pool = candidates(all, o)
  if (!pool.length) return { recipe: null, seen: new Set() }
  let nextSeen = new Set(seen)
  let fresh = pool.filter((r) => !nextSeen.has(r.id))
  if (!fresh.length) {
    nextSeen = new Set()
    fresh = pool.length > 1 ? pool.filter((r) => r.id !== lastId) : pool
  }
  const recipe = fresh[Math.floor(rng() * fresh.length)]
  nextSeen.add(recipe.id)
  return { recipe, seen: nextSeen }
}
