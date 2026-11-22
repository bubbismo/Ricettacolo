import { extractUrl } from './link'

export interface SharedContent {
  title: string
  text: string
  url: string
  files: number
}

/** Dal contenuto condiviso ricava link, proposta di titolo e note. Chrome mette l'indirizzo nel testo, altre app nell'url. */
export function interpretShare(c: Pick<SharedContent, 'title' | 'text' | 'url'>): { link: string; title: string; notes: string } {
  const link = extractUrl(c.url) ?? extractUrl(c.text) ?? ''
  let title = c.title.trim()
  if (title && (extractUrl(title) || title === c.text.trim())) title = '' // un titolo che è solo l'indirizzo non serve
  // testo senza link: non si butta, finisce nelle note
  const notes = link ? '' : c.text.trim()
  return { link, title, notes }
}
