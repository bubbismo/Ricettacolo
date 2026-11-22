import type { Collected, Hints, MicroEntry, RecipeData } from './types'

// ---------------- testo ----------------

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', euro: '€', copy: '©',
  reg: '®', trade: '™', bull: '•', middot: '·', times: '×', shy: '', ordm: 'º', ordf: 'ª',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù', acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  ccedil: 'ç', Ccedil: 'Ç', auml: 'ä', ouml: 'ö', uuml: 'ü', ntilde: 'ñ', szlig: 'ß', oelig: 'œ',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return ''
      return String.fromCodePoint(cp)
    }
    return ENTITIES[e] ?? m
  })
}

/** Testo pulito: entità decodificate, tag HTML tolti (a capo al posto di <br> e </p>), spazi in ordine. */
export function cleanText(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') return ''
  let s = decodeEntities(v)
  if (s.includes('<')) {
    s = s.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h[1-6]|tr)\s*>/gi, '\n').replace(/<[^>]*>/g, '')
  }
  return s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ---------------- durate e porzioni ----------------

/** "PT1H30M" → 90. Accetta anche giorni (P1DT2H), secondi e un numero semplice (minuti). null se non valida o zero. */
export function parseDuration(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : null
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (/^\d+$/.test(s)) return Number(s) > 0 ? Number(s) : null
  const m = s.match(/^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i)
  if (!m) return null
  const [w, d, h, min, sec] = [m[1], m[2], m[3], m[4], m[5]].map((x) => (x ? parseFloat(x) : 0))
  const total = Math.round(w * 7 * 1440 + d * 1440 + h * 60 + min + sec / 60)
  return total > 0 ? total : null
}

/** recipeYield può essere numero, testo o elenco ("4", "4 persone", ["4", "4 porzioni"]). */
export function parseYield(v: unknown): string | null {
  const items = Array.isArray(v) ? v : [v]
  const texts = items.map((x) => cleanText(typeof x === 'object' && x ? ((x as Record<string, unknown>).value ?? (x as Record<string, unknown>).name) : x)).filter(Boolean)
  if (!texts.length) return null
  return (texts.find((t) => /[a-zà-ù]/i.test(t) && /\d/.test(t)) ?? texts[0]).slice(0, 80)
}

// ---------------- JSON-LD ----------------

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)

function typesOf(o: Obj): string[] {
  const t = o['@type']
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string')
}
const isRecipe = (o: Obj) => typesOf(o).some((t) => /(^|[/#:])Recipe$/i.test(t))

function listOf(x: unknown): string[] {
  const out: string[] = []
  const walk = (v: unknown, d: number) => {
    if (d > 4 || v == null) return
    if (typeof v === 'string' || typeof v === 'number') { for (const l of cleanText(v).split('\n')) if (l.trim()) out.push(l.trim()) }
    else if (Array.isArray(v)) v.forEach((i) => walk(i, d + 1))
    else if (isObj(v)) walk(v.text ?? v.name ?? v.description, d + 1)
  }
  walk(x, 0)
  return out
}

/** Passaggi da qualunque forma: testo, elenco di testi, HowToStep, HowToSection annidate, ItemList. */
export function stepsOf(x: unknown): string[] {
  const out: string[] = []
  const walk = (v: unknown, d: number) => {
    if (d > 6 || v == null) return
    if (typeof v === 'string') {
      for (const line of cleanText(v).split('\n')) {
        const t = line.trim().replace(/^\d{1,2}\s*[.)]\s+/, '')
        if (t) out.push(t)
      }
    } else if (Array.isArray(v)) {
      v.forEach((i) => walk(i, d + 1))
    } else if (isObj(v)) {
      const types = typesOf(v)
      const nested = v.itemListElement ?? v.steps ?? v.step
      if (types.includes('HowToSection') || nested) {
        const heading = cleanText(v.name)
        if (heading && types.includes('HowToSection')) out.push(`## ${heading}`)
        walk(nested, d + 1)
        return
      }
      walk(v.text ?? v.description ?? v.name, d + 1)
    }
  }
  walk(x, 0)
  return out
}

function resolveImage(v: unknown, pageUrl: string): string | null {
  const walk = (x: unknown, d: number): string | null => {
    if (d > 3 || x == null) return null
    if (typeof x === 'string') {
      try {
        const u = new URL(decodeEntities(x.trim()), pageUrl)
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
      } catch { return null }
    }
    if (Array.isArray(x)) { for (const i of x) { const r = walk(i, d + 1); if (r) return r } return null }
    if (isObj(x)) return walk(x.url ?? x.contentUrl ?? x['@id'], d + 1)
    return null
  }
  return walk(v, 0)
}

function findRecipes(node: unknown, out: Obj[], depth = 0): void {
  if (depth > 6) return
  if (Array.isArray(node)) { node.forEach((n) => findRecipes(n, out, depth + 1)); return }
  if (!isObj(node)) return
  if (isRecipe(node)) { out.push(node); return }
  for (const v of Object.values(node)) if (typeof v === 'object' && v !== null) findRecipes(v, out, depth + 1)
}

function parseBlock(text: string): unknown[] {
  const t = text.trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
  if (!t) return []
  for (const candidate of [t, t.replace(/[\u0000-\u001f]+/g, ' ')]) {
    try { return [JSON.parse(candidate)] } catch { /* si prova la variante successiva */ }
  }
  return []
}

type Partial_ = Omit<RecipeData, 'site' | 'url'> & { site?: string }

const MAX = { title: 200, ingredients: 120, ingredientLen: 400, steps: 150, stepLen: 3000 }

function limit(r: Partial_): Partial_ {
  return {
    ...r,
    title: r.title.slice(0, MAX.title),
    ingredients: r.ingredients.slice(0, MAX.ingredients).map((s) => s.slice(0, MAX.ingredientLen)),
    steps: r.steps.slice(0, MAX.steps).map((s) => s.slice(0, MAX.stepLen)),
  }
}

const usable = (r: Partial_) => r.ingredients.length > 0 || r.steps.length > 0

export function recipeFromJsonLd(blocks: string[], pageUrl: string): Partial_ | null {
  const found: Obj[] = []
  for (const b of blocks) for (const j of parseBlock(b)) findRecipes(j, found)
  let best: Partial_ | null = null
  let bestScore = -1
  for (const o of found) {
    const publisher = isObj(o.publisher) ? cleanText(o.publisher.name) : ''
    const r: Partial_ = {
      title: cleanText(o.name ?? o.headline),
      ingredients: listOf(o.recipeIngredient ?? o.ingredients),
      steps: stepsOf(o.recipeInstructions),
      servings: parseYield(o.recipeYield),
      prepMinutes: parseDuration(o.prepTime),
      cookMinutes: parseDuration(o.cookTime),
      totalMinutes: parseDuration(o.totalTime),
      image: resolveImage(o.image, pageUrl),
      site: publisher || undefined,
    }
    const score = (r.ingredients.length ? 2 : 0) + (r.steps.length ? 2 : 0) + (r.title ? 1 : 0)
    if (score > bestScore) { best = r; bestScore = score }
  }
  return best && usable(best) ? limit(best) : best
}

/** Una ricetta nel JSON-LD, con ingredienti o passaggi? (per fermarsi appena la si trova) */
export const hasUsableJsonLd = (block: string, pageUrl: string): boolean => {
  const r = recipeFromJsonLd([block], pageUrl)
  return !!r && usable(r)
}

// ---------------- microdata ----------------

const CHILD_OF_STEPS = ['recipeInstructions', 'itemListElement', 'step', 'steps']

export function recipeFromMicrodata(entries: MicroEntry[], pageUrl: string): Partial_ | null {
  if (!entries.length) return null
  const vals = (...names: string[]) => entries.filter((e) => names.includes(e.name))
  const steps: string[] = []
  for (const e of entries) {
    if (e.name === 'recipeInstructions' && !e.hasChild) steps.push(...stepsOf(e.value))
    else if ((e.name === 'text' || e.name === 'description') && e.parent && CHILD_OF_STEPS.includes(e.parent)) steps.push(...stepsOf(e.value))
  }
  const first = (...names: string[]) => vals(...names)[0]?.value ?? ''
  const r: Partial_ = {
    title: cleanText(vals('name').find((e) => e.parent === null)?.value ?? ''),
    ingredients: vals('recipeIngredient', 'ingredients').flatMap((e) => listOf(e.value)),
    steps,
    servings: parseYield(first('recipeYield')),
    prepMinutes: parseDuration(first('prepTime')),
    cookMinutes: parseDuration(first('cookTime')),
    totalMinutes: parseDuration(first('totalTime')),
    image: resolveImage(first('image') || null, pageUrl),
  }
  return usable(r) ? limit(r) : null
}

// ---------------- risultato ----------------

export type Built = { recipe: RecipeData } | { hints: Hints }

export function buildResult(c: Collected, pageUrl: string): Built {
  const host = (() => { try { return new URL(pageUrl).hostname.replace(/^www\./i, '') } catch { return '' } })()
  // un nome del sito lungo ("Ricette di cucina - Le Ricette di …") è rumore: in quel caso meglio il dominio
  const rawSite = cleanText(c.og.siteName ?? '')
  const siteName = rawSite.length <= 40 ? rawSite : ''
  const pageTitle = cleanText(c.og.title ?? c.htmlTitle ?? '')

  const ld = recipeFromJsonLd(c.jsonLd, pageUrl)
  const pick = ld && usable(ld) ? ld : recipeFromMicrodata(c.micro, pageUrl)
  if (pick && usable(pick)) {
    return {
      recipe: {
        ...pick,
        title: pick.title || pageTitle,
        image: pick.image ?? resolveImage(c.og.image, pageUrl),
        site: (siteName || pick.site || host).slice(0, 80),
        url: pageUrl,
      },
    }
  }
  const hints: Hints = {}
  const t = (ld?.title || pageTitle).slice(0, MAX.title)
  if (t) hints.title = t
  const site = (siteName || host).slice(0, 80)
  if (site) hints.site = site
  const img = ld?.image ?? resolveImage(c.og.image, pageUrl)
  if (img) hints.image = img
  return { hints }
}
