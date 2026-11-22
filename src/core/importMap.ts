import { extractUrl } from './link'
import type { ParsedRecipeText } from './recipeText'

/** Ricetta come la restituisce il servizio di importazione (mai fidarsi: si controlla tutto prima di usarla). */
export interface RemoteRecipe {
  title: string
  ingredients: string[]
  steps: string[]
  servings: string | null
  prepMinutes: number | null
  cookMinutes: number | null
  totalMinutes: number | null
  image: string | null
  site: string
  url: string
}
export interface Hints { title?: string; site?: string; image?: string }

/** I campi del modulo "nuova ricetta" ricavati da una ricetta letta. Nessun campo dati nuovo. */
export interface Draft {
  title: string
  source: string
  link: string
  mainIngredients: string
  /** testo completo (ingredienti + preparazione): campo "Testo della ricetta", cercabile e leggibile a voce */
  text: string
  notes: string
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const list = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : []
const mins = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v) : null)
const httpUrl = (v: unknown): string | null => (typeof v === 'string' ? extractUrl(v) : null)

export function sanitizeRemote(x: unknown): RemoteRecipe | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const r: RemoteRecipe = {
    title: str(o.title, 200),
    ingredients: list(o.ingredients, 150, 400),
    steps: list(o.steps, 200, 3000),
    servings: str(o.servings, 80) || null,
    prepMinutes: mins(o.prepMinutes),
    cookMinutes: mins(o.cookMinutes),
    totalMinutes: mins(o.totalMinutes),
    image: httpUrl(o.image),
    site: str(o.site, 80),
    url: httpUrl(o.url) ?? '',
  }
  return r.title || r.ingredients.length || r.steps.length ? r : null
}

export function sanitizeHints(x: unknown): Hints | undefined {
  if (!x || typeof x !== 'object') return undefined
  const o = x as Record<string, unknown>
  const h: Hints = {}
  const t = str(o.title, 200), s = str(o.site, 80), i = httpUrl(o.image)
  if (t) h.title = t
  if (s) h.site = s
  if (i) h.image = i
  return Object.keys(h).length ? h : undefined
}

export function formatMinutes(n: number): string {
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60), m = n % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "6 porzioni · Preparazione: 20 min · Cottura: 40 min · Totale: 1 h": va nella prima riga delle Note. */
export function timesLine(r: Pick<RemoteRecipe, 'servings' | 'prepMinutes' | 'cookMinutes' | 'totalMinutes'>): string {
  const parts: string[] = []
  if (r.servings) parts.push(/^\d+$/.test(r.servings) ? `Porzioni: ${r.servings}` : r.servings)
  if (r.prepMinutes) parts.push(`Preparazione: ${formatMinutes(r.prepMinutes)}`)
  if (r.cookMinutes) parts.push(`Cottura: ${formatMinutes(r.cookMinutes)}`)
  if (r.totalMinutes) parts.push(`Totale: ${formatMinutes(r.totalMinutes)}`)
  return parts.join(' · ')
}

const UNITS = 'kg|g|gr|grammi|mg|l|lt|litri|litro|dl|cl|ml|hg|etti|etto|cucchiai|cucchiaio|cucchiaini|cucchiaino|tazze|tazza|bicchieri|bicchiere|pizzico|pizzichi|spicchi|spicchio|fette|fetta|foglie|foglia|rametti|rametto|ciuffi|ciuffo|noci|noce|bustine|bustina|barattolo|scatola|mazzetto|pezzi|pezzo|tbsp|tsp|cups?|oz|lb'
const LEAD = new RegExp(`^(?:\\d+(?:[.,/]\\d+)?(?:\\s*-\\s*\\d+(?:[.,/]\\d+)?)?|[½¼¾⅓⅔]|\\d+\\s*[½¼¾]|un[oa]?|mezz[oa]|qualche|poco|poca|un po'|due|tre)\\s*(?:(?:${UNITS})\\b\\.?)?\\s*(?:di\\b|d')?\\s*`, 'i')
const TRAIL = new RegExp(`\\s+(?:\\d+(?:[.,/]\\d+)?\\s*(?:(?:${UNITS})\\b\\.?)?|q\\.?\\s?b\\.?|quanto basta|a piacere)\\s*$`, 'i')

/** "500 g mascarpone" → "mascarpone"; "Savoiardi (circa 42 pezzi) 350 g" → "Savoiardi". */
export function ingredientName(line: string): string {
  let s = line.replace(/\([^)]*\)/g, ' ').replace(/^[\s\-–•*·]+/, '').trim()
  s = s.replace(LEAD, '')
  // un numero in fondo è una quantità ("uova 4"), tranne i tipi di farina ("farina 00", "tipo 0")
  if (!/\b(?:00?|tipo\s*\d)$/i.test(s) || /\d+(?:[.,/]\d+)?\s*(?:g|kg|gr|ml|l)\b/i.test(s)) s = s.replace(TRAIL, '')
  s = s.replace(/\bq\.?\s?b\.?(?=\s|$)/gi, '').replace(/^(?:di|d')\s*/i, '')
  return s.replace(/[,;:.\s]+$/, '').replace(/\s+/g, ' ').trim()
}

/** Elenco breve dei nomi degli ingredienti, per "Ingredienti principali" (serve alla ricerca). */
export function mainIngredients(lines: string[], maxLen = 300): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of lines) {
    if (l.startsWith('## ')) continue
    const n = ingredientName(l)
    const k = n.toLowerCase()
    if (!n || seen.has(k)) continue
    if ([...out, n].join(', ').length > maxLen) break
    seen.add(k)
    out.push(n)
  }
  return out.join(', ')
}

/** Testo completo, adatto a essere letto: "Ingredienti", elenco, "Preparazione", passaggi numerati. */
export function recipeText(ingredients: string[], steps: string[]): string {
  const parts: string[] = []
  if (ingredients.length) {
    parts.push('Ingredienti\n' + ingredients.map((l) => (l.startsWith('## ') ? `${l.slice(3)}:` : `- ${l}`)).join('\n'))
  }
  if (steps.length) {
    let n = 0
    parts.push('Preparazione\n' + steps.map((l) => (l.startsWith('## ') ? `${l.slice(3)}:` : `${++n}. ${l}`)).join('\n'))
  }
  return parts.join('\n\n')
}

export function remoteToDraft(r: RemoteRecipe): Draft {
  return {
    title: r.title,
    source: r.site,
    link: r.url,
    mainIngredients: mainIngredients(r.ingredients),
    text: recipeText(r.ingredients, r.steps),
    notes: timesLine(r),
  }
}

export function parsedToDraft(p: ParsedRecipeText, extra: { link?: string; title?: string } = {}): Draft {
  return {
    title: extra.title || p.title,
    source: '',
    link: extra.link ?? '',
    mainIngredients: mainIngredients(p.ingredients),
    text: recipeText(p.ingredients, p.steps),
    notes: '',
  }
}
