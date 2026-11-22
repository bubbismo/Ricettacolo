/** Ricetta restituita all'app: solo i dati utili, mai la pagina. */
export interface RecipeData {
  title: string
  ingredients: string[]
  /** Passaggi in ordine. Le righe che iniziano con "## " sono intestazioni di sezione (es. "## Per la crema"). */
  steps: string[]
  servings: string | null
  prepMinutes: number | null
  cookMinutes: number | null
  totalMinutes: number | null
  /** indirizzo dell'immagine (non viene scaricata dal servizio nella risposta di /recipe) */
  image: string | null
  site: string
  url: string
}

export type ErrorCode =
  | 'bad_url' | 'blocked' | 'too_large' | 'timeout' | 'not_html' | 'upstream_error'
  | 'no_recipe' | 'rate_limited' | 'unauthorized' | 'forbidden_origin' | 'bad_request'

/** Se non c'è una ricetta strutturata, almeno titolo, sito e immagine della pagina. */
export interface Hints { title?: string; site?: string; image?: string }

export type RecipeResponse =
  | { ok: true; recipe: RecipeData }
  | { ok: false; error: ErrorCode; message: string; hints?: Hints; upstreamStatus?: number }

/** Voce di microdata raccolta dalla pagina (itemprop dentro un itemtype Recipe). */
export interface MicroEntry { name: string; value: string; parent: string | null; hasChild: boolean }

export interface Collected {
  jsonLd: string[]
  micro: MicroEntry[]
  og: { title?: string; image?: string; siteName?: string }
  htmlTitle?: string
}
