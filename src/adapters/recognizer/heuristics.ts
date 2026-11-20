import type { RecognizedRecipe } from './types'

const ING = /^\s*(ingredienti|ingredienti principali|occorrente|per la (?:pasta|crema|base|farcia|ricetta)\b)\s*[:\-]?\s*$/i
const STEPS = /^\s*(procedimento|preparazione|esecuzione|come si prepara|come si fa|metodo|realizzazione)\s*[:\-]?\s*$/i

const stripBullet = (l: string) => l.replace(/^[\s\-–•*·▪►>]+/, '').trim()

function sentenceCase(s: string): string {
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '')
  if (letters && letters === letters.toUpperCase()) return s.charAt(0) + s.slice(1).toLowerCase()
  return s
}

/** Ricava titolo, ingredienti e procedimento da un testo grezzo, con regole semplici e prudenti (nel dubbio non inventa nulla). */
export function structureText(raw: string): RecognizedRecipe {
  const rawText = raw.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const lines = rawText.split('\n').map((l) => l.trim())
  const iIng = lines.findIndex((l) => ING.test(l) || /^ingredienti\b/i.test(l) && l.length < 40)
  const iSteps = lines.findIndex((l, i) => i > iIng && STEPS.test(l))

  const out: RecognizedRecipe = { rawText }

  const firstHeader = [iIng, iSteps].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? lines.length
  const title = lines.slice(0, firstHeader).map(stripBullet).find((l) => l.length >= 3 && l.length <= 80 && /[A-Za-zÀ-ÿ]{3}/.test(l))
  if (title) out.title = sentenceCase(title.replace(/[:.\s]+$/, ''))

  if (iIng >= 0) {
    const end = iSteps >= 0 ? iSteps : lines.length
    const items = lines.slice(iIng + (ING.test(lines[iIng]) ? 1 : 0), end).map(stripBullet).filter(Boolean)
    const joined = items.join(', ').replace(/,\s*,/g, ',')
    if (joined) out.ingredients = joined.length > 300 ? `${joined.slice(0, 297)}…` : joined
  }
  if (iSteps >= 0) {
    const steps = lines.slice(iSteps + 1).join('\n').trim()
    if (steps) out.steps = steps
  }
  return out
}
