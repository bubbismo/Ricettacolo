/** Utilità per i link alle ricette sul web. Solo http/https: nient'altro viene mai salvato né reso cliccabile. */

const URL_RE = /https?:\/\/[^\s<>"'“”‘’]+/i

/** Toglie la punteggiatura che di solito chiude una frase, senza rovinare gli indirizzi con parentesi (es. Wikipedia). */
function trimTrailing(u: string): string {
  for (;;) {
    const last = u.slice(-1)
    if (/[.,;:!?…»\]}>]/.test(last)) u = u.slice(0, -1)
    else if (last === ')' && !u.includes('(')) u = u.slice(0, -1)
    else return u
  }
}

/** Estrae il primo indirizzo web da un testo qualunque ("Guarda qui https://… che buona!"). null se non c'è un indirizzo valido. */
export function extractUrl(text: string | null | undefined): string | null {
  const m = (text ?? '').match(URL_RE)
  if (!m) return null
  const u = trimTrailing(m[0])
  try {
    const p = new URL(u)
    return (p.protocol === 'http:' || p.protocol === 'https:') && p.hostname ? u : null
  } catch {
    return null
  }
}

/** Valore sicuro da salvare: l'indirizzo estratto, oppure stringa vuota. */
export const cleanLink = (v: unknown): string => (typeof v === 'string' ? (extractUrl(v) ?? '') : '')

/** Messaggio di errore per il campo, o '' se va bene (anche se vuoto: il link è facoltativo). */
export function linkError(value: string): string {
  const v = value.trim()
  if (!v) return ''
  return extractUrl(v) ? '' : 'Il link deve iniziare con http:// o https://'
}

/** "gialloZafferano.it" da un indirizzo, per mostrarlo in modo leggibile. */
export function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./i, '') } catch { return url }
}

/** Per riconoscere lo stesso link scritto in modi un po' diversi (www, barra finale, parametri di tracciamento, #ancora). */
export function linkKey(url: string): string {
  try {
    const p = new URL(url)
    const params = [...p.searchParams.entries()].filter(([k]) => !/^(utm_|fbclid|gclid|igshid)/i.test(k)).sort(([a], [b]) => a.localeCompare(b))
    const qs = params.map(([k, v]) => `${k}=${v}`).join('&')
    return `${p.hostname.replace(/^www\./i, '').toLowerCase()}${p.pathname.replace(/\/+$/, '')}${qs ? `?${qs}` : ''}`
  } catch {
    return url.trim().toLowerCase()
  }
}
