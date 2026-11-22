/** Impostazioni e messaggi del servizio di importazione (facoltativo). */

/** Indirizzo del servizio: solo https (o http su questo stesso computer, per provare); senza barra finale. '' se non valido. */
export function normalizeServiceUrl(v: string): string {
  const s = v.trim().replace(/\/+$/, '')
  if (!s) return ''
  try {
    const u = new URL(s)
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '')}`
  } catch { /* indirizzo non valido */ }
  return ''
}

export type ImportErrorCode =
  | 'bad_url' | 'blocked' | 'too_large' | 'timeout' | 'not_html' | 'upstream_error' | 'no_recipe' | 'rate_limited'
  | 'unauthorized' | 'forbidden_origin' | 'bad_request' | 'network' | 'cancelled' | 'service_error'

const MESSAGES: Record<ImportErrorCode, string> = {
  bad_url: 'Questo indirizzo non è valido.',
  blocked: 'Questo indirizzo non può essere letto.',
  too_large: 'La pagina è troppo grande per essere letta.',
  timeout: 'Il sito ha risposto troppo lentamente.',
  not_html: 'L\'indirizzo non porta a una pagina web.',
  upstream_error: 'Il sito non ha lasciato leggere la pagina (a volte blocca i programmi).',
  no_recipe: 'In questa pagina non ho trovato una ricetta leggibile.',
  rate_limited: 'Troppe richieste in poco tempo: riprova fra un minuto.',
  unauthorized: 'La chiave del servizio non è corretta: controllala nelle Impostazioni.',
  forbidden_origin: 'Il servizio non è configurato per questa app.',
  bad_request: 'Richiesta non valida.',
  network: 'Non riesco a raggiungere il servizio (sei senza rete?).',
  cancelled: 'Lettura annullata.',
  service_error: 'Il servizio non risponde come previsto (forse ha raggiunto il limite giornaliero).',
}

export const importErrorMessage = (c: ImportErrorCode): string => MESSAGES[c] ?? MESSAGES.service_error

export const KNOWN_CODES = Object.keys(MESSAGES) as ImportErrorCode[]
