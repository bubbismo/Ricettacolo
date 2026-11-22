import { KNOWN_CODES, importErrorMessage, type ImportErrorCode } from '../../core/importService'
import { sanitizeHints, sanitizeRemote, type Hints, type RemoteRecipe } from '../../core/importMap'

export interface ServiceConfig { url: string; key: string }

export type ImportOutcome =
  | { ok: true; recipe: RemoteRecipe }
  | { ok: false; code: ImportErrorCode; message: string; hints?: Hints }

const TIMEOUT_MS = 15_000

function headers(cfg: ServiceConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.key) h['X-Ricettacolo-Key'] = cfg.key
  return h
}

/** fetch con tempo massimo e annullamento da parte dell'utente. */
async function call(cfg: ServiceConfig, path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), TIMEOUT_MS)
  const onAbort = () => ctl.abort(new DOMException('cancelled', 'AbortError'))
  signal?.addEventListener('abort', onAbort)
  try {
    return await fetch(`${cfg.url}${path}`, { ...init, signal: ctl.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function failure(code: ImportErrorCode, hints?: Hints): ImportOutcome {
  return { ok: false, code, message: importErrorMessage(code), hints }
}

function thrownToCode(e: unknown, signal?: AbortSignal): ImportErrorCode {
  if (signal?.aborted) return 'cancelled'
  const name = (e as { name?: string })?.name
  if (name === 'TimeoutError') return 'timeout'
  if (name === 'AbortError') return 'cancelled'
  return 'network'
}

/** Chiede al servizio di leggere la ricetta da un indirizzo. Non lancia mai: restituisce sempre un esito. */
export async function importRecipe(link: string, cfg: ServiceConfig, signal?: AbortSignal): Promise<ImportOutcome> {
  let res: Response
  try {
    res = await call(cfg, '/recipe', { method: 'POST', headers: headers(cfg), body: JSON.stringify({ url: link }) }, signal)
  } catch (e) {
    return failure(thrownToCode(e, signal))
  }
  let body: unknown
  try { body = await res.json() } catch { return failure('service_error') }
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (o.ok === true) {
    const recipe = sanitizeRemote(o.recipe)
    return recipe ? { ok: true, recipe } : failure('no_recipe')
  }
  const code = KNOWN_CODES.includes(o.error as ImportErrorCode) ? (o.error as ImportErrorCode) : 'service_error'
  return failure(code, sanitizeHints(o.hints))
}

/** Scarica l'immagine tramite il servizio (il browser da solo non può leggere immagini di altri siti). Solo su richiesta. */
export async function fetchImage(url: string, cfg: ServiceConfig): Promise<Blob> {
  const res = await call(cfg, '/image', { method: 'POST', headers: headers(cfg), body: JSON.stringify({ url }) })
  if (!res.ok) throw new Error('image')
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('image')
  return blob
}

/** Prova del servizio dalle Impostazioni. */
export async function testService(cfg: ServiceConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await call(cfg, '/health', { method: 'GET', headers: cfg.key ? { 'X-Ricettacolo-Key': cfg.key } : {} })
    if (res.ok) return { ok: true, message: 'Servizio raggiungibile: tutto a posto.' }
    let code: ImportErrorCode = 'service_error'
    try { const j = (await res.json()) as { error?: string }; if (KNOWN_CODES.includes(j.error as ImportErrorCode)) code = j.error as ImportErrorCode } catch { /* non è JSON */ }
    return { ok: false, message: importErrorMessage(code) }
  } catch {
    return { ok: false, message: importErrorMessage('network') }
  }
}
