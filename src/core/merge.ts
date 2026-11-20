import type { Recipe } from './recipe'

export type MergeAction = 'add' | 'update' | 'skip'

/**
 * Regola di importazione, per ogni ricetta:
 * - id assente → aggiungi
 * - id presente, hash uguale → salta (identica)
 * - id presente, hash diverso → vince l'ultima modifica più recente; a parità si tiene la copia locale.
 */
export function decideMerge(local: Recipe | undefined, incoming: Recipe): MergeAction {
  if (!local) return 'add'
  if (local.hash === incoming.hash) return 'skip'
  return Date.parse(incoming.updatedAt) > Date.parse(local.updatedAt) ? 'update' : 'skip'
}

export interface MergeSummary {
  added: number
  updated: number
  skipped: number
}
