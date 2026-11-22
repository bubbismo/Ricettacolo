/**
 * Legge un testo di ricetta incollato o condiviso (non una pagina web): cerca i titoli "Ingredienti" e
 * "Preparazione / Procedimento / Istruzioni…", riconosce le righe con quantità e divide il testo.
 * Prudente: se non è sicuro non inventa nulla (`confident: false`).
 */

export interface ParsedRecipeText {
  title: string
  /** righe di ingredienti; quelle che iniziano con "## " sono intestazioni di gruppo ("Per la crema") */
  ingredients: string[]
  /** passaggi senza numerazione; "## " = intestazione di sezione */
  steps: string[]
  confident: boolean
}

const BULLET = /^[\s\-–—•*·▪►>]+/
const UNITS = 'kg|g|gr|grammi|mg|l|lt|litri|litro|dl|cl|ml|hg|etti|etto|cucchiai|cucchiaio|cucchiaini|cucchiaino|tazze|tazza|bicchieri|bicchiere|pizzico|pizzichi|spicchi|spicchio|fette|fetta|foglie|foglia|rametti|rametto|ciuffi|ciuffo|noci|noce|bustine|bustina|barattolo|scatola|mazzetto|pezzi|pezzo|tbsp|tsp|cups?|oz|lb'

const HDR_REST = (rest: string) =>
  rest === '' || /^[:\-–]/.test(rest) || /^\(.*\)\s*:?$/.test(rest) || /^(per|x|for)\s.{0,40}:?$/i.test(rest)

function header(line: string, words: string): { ok: boolean; inline: string } {
  const m = line.match(new RegExp(`^[\\s#*_\\-–•]*(?:${words})\\b(.{0,70})$`, 'i'))
  if (!m) return { ok: false, inline: '' }
  const rest = m[1].replace(/[*_]+$/g, '').trim()
  if (!HDR_REST(rest)) return { ok: false, inline: '' }
  const inline = rest.startsWith(':') ? rest.slice(1).trim() : ''
  return { ok: true, inline }
}
const isIngHeader = (l: string) => header(l, 'ingredienti|ingredients')
const isStepsHeader = (l: string) =>
  header(l, 'preparazione|procedimento|istruzioni|esecuzione|metodo|svolgimento|come si prepara|come si fa|direzioni|preparation|instructions|method|directions')

const QTY_START = new RegExp(`^(?:\\d+(?:[.,/]\\d+)?(?:\\s*-\\s*\\d+(?:[.,/]\\d+)?)?|[½¼¾⅓⅔]|\\d+\\s*[½¼¾]|un[oa]?|mezz[oa]|qualche|poco|poca|un po'|due|tre|q\\.?\\s?b\\.?)\\b`, 'i')
const QTY_END = new RegExp(`(?:\\d+(?:[.,/]\\d+)?\\s*(?:${UNITS})\\b\\.?|q\\.?\\s?b\\.?|quanto basta|a piacere)\\s*$`, 'i')

/** Riga da elenco ingredienti: breve, con una quantità all'inizio ("200 g farina", "2 uova", "q.b. sale") o alla fine ("Mascarpone 1 kg"). */
export function isQuantityLine(raw: string): boolean {
  const line = raw.replace(BULLET, '').trim()
  if (!line || line.length > 90) return false
  if (/[.!?]$/.test(line) && !/q\.?\s?b\.?$/i.test(line)) return false // una frase, non un ingrediente
  if (line.split(/\s+/).length > 12) return false
  return QTY_START.test(line) || QTY_END.test(line)
}

const clean = (l: string) => l.replace(BULLET, '').trim()
const unnumber = (l: string) => l.replace(/^\d{1,2}\s*[.)]\s+/, '').trim()

function splitInline(s: string): string[] {
  const parts = s.includes(';') ? s.split(';') : s.split(/,(?![^()]*\))/)
  return parts.map(clean).filter(Boolean)
}

function asHeading(line: string): string | null {
  const t = clean(line)
  return /:$/.test(t) && t.length <= 50 && !isQuantityLine(t.slice(0, -1)) ? `## ${t.slice(0, -1).trim()}` : null
}

function toIngredients(lines: string[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    if (!l.trim()) continue
    const h = asHeading(l)
    out.push(h ?? clean(l))
  }
  return out.filter(Boolean)
}
function toSteps(lines: string[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    if (!l.trim()) continue
    out.push(asHeading(l) ?? unnumber(l.trim().replace(BULLET, '')))
  }
  return out.filter(Boolean)
}

export function parseRecipeText(text: string): ParsedRecipeText {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim())
  const none: ParsedRecipeText = { title: '', ingredients: [], steps: [], confident: false }
  if (lines.filter(Boolean).length < 2) return none

  const heads: { type: 'ing' | 'steps'; idx: number; inline: string }[] = []
  lines.forEach((l, idx) => {
    const a = isIngHeader(l)
    if (a.ok && !heads.some((h) => h.type === 'ing')) { heads.push({ type: 'ing', idx, inline: a.inline }); return }
    const b = isStepsHeader(l)
    if (b.ok && !heads.some((h) => h.type === 'steps')) heads.push({ type: 'steps', idx, inline: b.inline })
  })

  const pickTitle = (upTo: number) =>
    lines.slice(0, upTo).map(clean).find((l) => l.length >= 3 && l.length <= 80 && !isQuantityLine(l) && !/^https?:\/\//i.test(l) && /[a-zà-ù]{3}/i.test(l)) ?? ''

  if (heads.length) {
    const seg = (h: (typeof heads)[number], i: number): string[] => {
      const end = heads[i + 1]?.idx ?? lines.length
      return [...(h.inline ? splitInline(h.inline) : []), ...lines.slice(h.idx + 1, end)]
    }
    let ingredients: string[] = []
    let steps: string[] = []
    heads.forEach((h, i) => {
      const s = seg(h, i)
      if (h.type === 'ing') {
        // senza un titolo "Preparazione": dopo una riga vuota, un paragrafo lungo che non è un ingrediente è il procedimento
        const blank = heads.length === 1 ? s.findIndex((l, k) => k > 0 && s[k - 1] === '' && l && !isQuantityLine(l) && l.length > 40) : -1
        ingredients = toIngredients(blank > 0 ? s.slice(0, blank) : s)
        if (blank > 0) steps = toSteps(s.slice(blank))
      } else steps = toSteps(s)
    })
    const title = pickTitle(heads[0].idx)
    return { title, ingredients, steps, confident: ingredients.length > 0 || steps.length > 0 }
  }

  // senza titoli: cerca una serie di almeno 3 righe con quantità (le righe vuote in mezzo non la interrompono)
  let best: [number, number] | null = null
  let start = -1, last = -1, count = 0
  const close = () => { if (count >= 3 && (!best || count > best[1] - best[0])) best = [start, last + 1]; start = -1; count = 0 }
  lines.forEach((l, i) => {
    if (isQuantityLine(l)) { if (start < 0) start = i; last = i; count++ }
    else if (l) close()
  })
  close()
  if (!best) return none
  const [a, b] = best as [number, number]
  const rest = lines.slice(b).filter(Boolean)
  const steps = rest.some((l) => l.length >= 25) ? toSteps(rest) : []
  return { title: pickTitle(a), ingredients: toIngredients(lines.slice(a, b)), steps, confident: true }
}
