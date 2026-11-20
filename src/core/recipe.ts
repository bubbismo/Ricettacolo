/** Modello dati della ricetta (schema versione 1). */

export const SCHEMA_VERSION = 1

export type Rating = 1 | 2 | 3 | 4 | 5

export interface Recipe {
  /** UUID assegnato alla creazione, mai cambiato */
  id: string
  schemaVersion: number
  /** SHA-256 di metadati + id delle foto, ricalcolato a ogni modifica */
  hash: string
  createdAt: string
  updatedAt: string
  /** id delle foto, in ordine di pagina */
  photoIds: string[]
  title: string
  source: string
  /** AAAA-MM-GG */
  date: string
  categories: string[]
  rating: Rating | null
  favorite: boolean
  mainIngredients: string
  notes: string
  /** AAAA-MM-GG dell'ultima volta cucinata */
  lastCookedAt: string | null
  ocrText: string | null
}

/** I campi modificabili dall'utente (tutto tranne identità, hash e date tecniche). */
export type RecipeContent = Pick<
  Recipe,
  | 'photoIds' | 'title' | 'source' | 'date' | 'categories' | 'rating' | 'favorite'
  | 'mainIngredients' | 'notes' | 'lastCookedAt' | 'ocrText'
>

export interface PhotoRecord {
  id: string
  blob: Blob
  mime: string
  width: number
  height: number
  sha256: string
  createdAt: string
}

export interface ThumbRecord {
  photoId: string
  blob: Blob
}

export interface InboxItem {
  id: string
  photoId: string
  addedAt: string
}

export interface CategoryRecord {
  name: string
  order: number
}

export const DEFAULT_CATEGORIES = [
  'Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Lievitati', 'Conserve', 'Bevande',
]

export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export function newId(): string {
  return crypto.randomUUID()
}

export function emptyContent(): RecipeContent {
  return {
    photoIds: [], title: '', source: '', date: todayISO(), categories: [], rating: null,
    favorite: false, mainIngredients: '', notes: '', lastCookedAt: null, ocrText: null,
  }
}

/** Porta un oggetto qualunque (anche di versioni passate o malformato) a una Recipe valida. Non perde mai campi noti. */
export function normalizeRecipe(raw: Partial<Recipe> & { id: string }): Recipe {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const r = raw.rating
  const now = new Date().toISOString()
  return {
    id: raw.id,
    schemaVersion: SCHEMA_VERSION,
    hash: str(raw.hash),
    createdAt: str(raw.createdAt) || now,
    updatedAt: str(raw.updatedAt) || str(raw.createdAt) || now,
    photoIds: Array.isArray(raw.photoIds) ? raw.photoIds.filter((x) => typeof x === 'string') : [],
    title: str(raw.title),
    source: str(raw.source),
    date: str(raw.date) || todayISO(),
    categories: Array.isArray(raw.categories) ? raw.categories.filter((x) => typeof x === 'string') : [],
    rating: r === 1 || r === 2 || r === 3 || r === 4 || r === 5 ? r : null,
    favorite: raw.favorite === true,
    mainIngredients: str(raw.mainIngredients),
    notes: str(raw.notes),
    lastCookedAt: typeof raw.lastCookedAt === 'string' && raw.lastCookedAt ? raw.lastCookedAt : null,
    ocrText: typeof raw.ocrText === 'string' && raw.ocrText ? raw.ocrText : null,
  }
}

export function toContent(r: Recipe): RecipeContent {
  return {
    photoIds: [...r.photoIds], title: r.title, source: r.source, date: r.date, categories: [...r.categories],
    rating: r.rating, favorite: r.favorite, mainIngredients: r.mainIngredients, notes: r.notes,
    lastCookedAt: r.lastCookedAt, ocrText: r.ocrText,
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}
