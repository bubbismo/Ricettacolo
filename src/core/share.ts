import { extractUrl } from './link'
import { parseRecipeText, type ParsedRecipeText } from './recipeText'

export interface SharedContent {
  title: string
  text: string
  url: string
  files: number
}

export interface ShareIntent {
  link: string
  title: string
  notes: string
  /** il testo condiviso è una ricetta riconoscibile (titoli "Ingredienti"/"Preparazione" o righe con quantità) */
  parsed: ParsedRecipeText | null
}

/**
 * Dal contenuto condiviso ricava link, proposta di titolo, e se il testo è una ricetta la divide nei campi.
 * Chrome mette l'indirizzo nel testo, altre app nell'url.
 */
export function interpretShare(c: Pick<SharedContent, 'title' | 'text' | 'url'>): ShareIntent {
  const link = extractUrl(c.url) ?? extractUrl(c.text) ?? ''
  const body = link ? c.text.replace(link, ' ') : c.text
  const p = parseRecipeText(body)
  const parsed = p.confident ? p : null
  let title = c.title.trim()
  if (title && (extractUrl(title) || title === c.text.trim())) title = '' // un titolo che è solo l'indirizzo non serve
  // testo senza link né struttura di ricetta: non si butta, finisce nelle note
  const notes = !link && !parsed ? c.text.trim() : ''
  return { link, title, notes, parsed }
}
