import { normalizeRecipe, SCHEMA_VERSION, type Recipe } from './recipe'

/**
 * Migrazioni dei record ricetta e del file di backup. Regola: solo additive,
 * mai perdere un campo. Ogni versione passata deve restare leggibile.
 */
export function migrateRecipe(raw: unknown): Recipe | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<Recipe>
  if (typeof o.id !== 'string' || !o.id) return null
  // v1 → v2: è arrivato `link`; manca nei record vecchi e normalizeRecipe lo porta a vuoto, senza toccare altro.
  // Le future versioni aggiungeranno passi qui, in base a o.schemaVersion.
  return normalizeRecipe(o as Partial<Recipe> & { id: string })
}

export const CURRENT_SCHEMA = SCHEMA_VERSION
