/**
 * Quali indirizzi il servizio accetta di scaricare. Regola semplice e prudente:
 * solo http/https sulle porte standard, solo nomi di sito (mai indirizzi IP, di nessun tipo),
 * mai nomi "interni" o locali. I nomi che puntano a indirizzi privati tramite DNS non si possono
 * verificare da un Worker, ma il Worker gira sulla rete di Cloudflare, non dentro una rete privata:
 * non ha nulla di interno da raggiungere. Questo controllo è una seconda barriera.
 */

export type Verdict = { ok: true; url: URL } | { ok: false; reason: 'bad_url' | 'blocked' }

const BLOCKED_SUFFIXES = [
  '.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp', '.private', '.localdomain', '.home.arpa',
  // servizi che trasformano un indirizzo IP in un nome di sito
  '.nip.io', '.sslip.io', '.xip.io', '.localtest.me', '.lvh.me', '.traefik.me', '.vcap.me',
]
const BLOCKED_NAMES = ['localhost', 'nip.io', 'sslip.io', 'xip.io', 'localtest.me', 'lvh.me']

export function validateTarget(raw: unknown): Verdict {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return { ok: false, reason: 'bad_url' }
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, reason: 'bad_url' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'bad_url' }
  if (url.username || url.password) return { ok: false, reason: 'blocked' }
  if (url.port && url.port !== '80' && url.port !== '443') return { ok: false, reason: 'blocked' }

  // il parser WHATWG riscrive le forme strane (0x7f.1, 2130706433, 017700000001) in quartine decimali: le prende tutte
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return { ok: false, reason: 'bad_url' }
  if (host.startsWith('[') || host.includes(':')) return { ok: false, reason: 'blocked' } // IPv6
  if (/^[\d.]+$/.test(host)) return { ok: false, reason: 'blocked' } // IPv4 in qualunque forma
  if (/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+))*$/i.test(host)) return { ok: false, reason: 'blocked' }
  if (!host.includes('.')) return { ok: false, reason: 'blocked' } // "metadata", "intranet", nomi senza dominio
  if (BLOCKED_NAMES.includes(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, reason: 'blocked' }
  // l'ultima parte (dominio di primo livello) non può essere numerica
  if (/^\d+$/.test(host.slice(host.lastIndexOf('.') + 1))) return { ok: false, reason: 'blocked' }
  return { ok: true, url }
}

/** L'origine della richiesta è tra quelle consentite? (elenco separato da virgole, niente "*") */
export function originAllowed(origin: string | null, allowedList: string | undefined): boolean {
  if (!origin || !allowedList) return false
  return allowedList.split(',').map((s) => s.trim().replace(/\/$/, '')).filter((s) => s && s !== '*').includes(origin.replace(/\/$/, ''))
}

/** Confronto a tempo costante, per la chiave personale. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a), y = enc.encode(b)
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}
