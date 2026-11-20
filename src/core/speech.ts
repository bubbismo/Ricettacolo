/** Spezza il testo in frasi/blocchi brevi: le voci di sistema si interrompono sui testi lunghi. Senza regex con lookbehind (Safari vecchi). */
export function splitForSpeech(text: string, maxLen = 220): string[] {
  const clean = text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim()
  if (!clean) return []
  const sentences = clean.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [clean]
  const chunks: string[] = []
  let cur = ''
  const push = () => { if (cur.trim()) chunks.push(cur.trim()); cur = '' }
  for (const s of sentences) {
    if (s.length > maxLen) {
      push()
      for (const w of s.split(' ')) {
        if ((cur + ' ' + w).length > maxLen) push()
        cur += (cur ? ' ' : '') + w
      }
      push()
    } else if ((cur + s).length > maxLen) {
      push()
      cur = s
    } else cur += s
  }
  push()
  return chunks
}
