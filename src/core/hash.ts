import type { RecipeContent } from './recipe'

/** JSON canonico del contenuto: campi in ordine fisso, categorie ordinate. Le foto contano per id, non per byte. */
export function canonicalContent(c: RecipeContent): string {
  return JSON.stringify([
    c.photoIds,
    c.title.trim(),
    c.source.trim(),
    c.date,
    [...c.categories].sort(),
    c.rating,
    c.favorite,
    c.mainIngredients.trim(),
    c.notes.trim(),
    c.lastCookedAt,
    c.ocrText,
    // il link entra nell'hash solo se c'è: le ricette senza link mantengono l'hash che avevano prima (schema v1)
    ...(c.link?.trim() ? [c.link.trim()] : []),
  ])
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function contentHash(c: RecipeContent): Promise<string> {
  return sha256Hex(canonicalContent(c))
}
