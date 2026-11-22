import { createCollector } from './collect'
import { buildResult } from './extract'
import { originAllowed, safeEqual, validateTarget } from './security'
import type { ErrorCode, RecipeResponse } from './types'

export interface Env {
  /** origini autorizzate a usare il servizio, separate da virgole (mai "*") */
  ALLOWED_ORIGINS: string
  /** chiave personale facoltativa: se impostata (wrangler secret put ACCESS_TOKEN) l'app deve mandarla */
  ACCESS_TOKEN?: string
  /** limite di richieste per client (vedi wrangler.toml) */
  LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> }
  /** solo per i test */
  FETCH_TIMEOUT_MS?: string
}

const LIMITS = { timeoutMs: 8000, maxRedirects: 3, maxHtmlBytes: 2 * 1024 * 1024, maxImageBytes: 6 * 1024 * 1024, maxBody: 4096 }
const UA = 'Ricettacolo/1.0 (importazione personale di una ricetta; richiesta singola)'

const MESSAGES: Record<ErrorCode, string> = {
  bad_url: 'Indirizzo non valido.',
  blocked: 'Questo indirizzo non può essere letto.',
  too_large: 'La pagina è troppo grande.',
  timeout: 'Il sito ha risposto troppo lentamente.',
  not_html: 'Il contenuto non è del tipo atteso (pagina web o immagine).',
  upstream_error: 'Il sito non ha lasciato leggere la pagina.',
  no_recipe: 'Nessuna ricetta strutturata trovata in questa pagina.',
  rate_limited: 'Troppe richieste: riprova fra un minuto.',
  unauthorized: 'Chiave non valida.',
  forbidden_origin: 'Origine non autorizzata.',
  bad_request: 'Richiesta non valida.',
}
const STATUS: Record<ErrorCode, number> = {
  bad_url: 400, blocked: 403, too_large: 413, timeout: 504, not_html: 415, upstream_error: 502,
  no_recipe: 422, rate_limited: 429, unauthorized: 401, forbidden_origin: 403, bad_request: 400,
}

class Fail extends Error {
  constructor(public code: ErrorCode, public upstreamStatus?: number) { super(code) }
}

function cors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Ricettacolo-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: RecipeResponse | { ok: true; [k: string]: unknown }, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } })
}
const failure = (code: ErrorCode, h: Record<string, string>, extra: Partial<Extract<RecipeResponse, { ok: false }>> = {}) =>
  json({ ok: false, error: code, message: MESSAGES[code], ...extra }, STATUS[code], h)

/** Scarica una pagina con tutte le precauzioni: ogni destinazione (anche dopo i reindirizzamenti) è ricontrollata. */
async function download(start: string, accept: string, timeoutMs: number): Promise<{ res: Response; finalUrl: string; done: () => void }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  const done = () => clearTimeout(timer)
  try {
    let current = start
    for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
      const v = validateTarget(current)
      if (!v.ok) throw new Fail(v.reason)
      const res = await fetch(v.url.href, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'it,en;q=0.8' } })
      const loc = res.headers.get('Location')
      if (res.status >= 300 && res.status < 400 && loc) {
        void res.body?.cancel()
        try { current = new URL(loc, v.url).href } catch { throw new Fail('bad_url') }
        continue
      }
      if (res.status >= 400) { void res.body?.cancel(); throw new Fail('upstream_error', res.status) }
      return { res, finalUrl: v.url.href, done }
    }
    throw new Fail('upstream_error') // troppi reindirizzamenti
  } catch (e) {
    done()
    if (e instanceof Fail) throw e
    throw new Fail(ctl.signal.aborted ? 'timeout' : 'upstream_error')
  }
}

/**
 * Limita i byte letti; si ferma in anticipo se `stop()` lo chiede. Oltre il limite segnala `state.tooLarge`
 * (l'errore, passando dall'HTMLRewriter, cambierebbe forma: il segnale è più affidabile).
 */
function capped(body: ReadableStream<Uint8Array>, max: number, state: { tooLarge: boolean }, stop: () => boolean = () => false): ReadableStream<Uint8Array> {
  let n = 0
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      n += chunk.byteLength
      if (n > max) { state.tooLarge = true; ctrl.error(new Error('troppo grande')); return }
      if (stop()) { ctrl.terminate(); return }
      ctrl.enqueue(chunk)
    },
  }))
}

async function handleRecipe(url: string, env: Env, h: Record<string, string>): Promise<Response> {
  const timeout = Number(env.FETCH_TIMEOUT_MS) || LIMITS.timeoutMs
  const { res, finalUrl, done } = await download(url, 'text/html,application/xhtml+xml;q=0.9', timeout)
  try {
    if (!/^(text\/html|application\/xhtml\+xml)/i.test(res.headers.get('Content-Type') ?? '')) {
      void res.body?.cancel()
      throw new Fail('not_html')
    }
    const { rewriter, collected, isDone } = createCollector(finalUrl)
    const size = { tooLarge: false }
    const stream = capped(res.body ?? new ReadableStream({ start: (c) => c.close() }), LIMITS.maxHtmlBytes, size, isDone)
    const transformed = rewriter.transform(new Response(stream, { headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'text/html' } }))
    try {
      await transformed.body?.pipeTo(new WritableStream())
    } catch (e) {
      if (size.tooLarge) throw new Fail('too_large')
      throw e
    }
    const built = buildResult(collected, finalUrl)
    if ('recipe' in built) return json({ ok: true, recipe: built.recipe }, 200, h)
    return failure('no_recipe', h, { hints: built.hints })
  } catch (e) {
    if (e instanceof Fail) throw e
    throw new Fail((e as Error)?.name === 'AbortError' ? 'timeout' : 'upstream_error')
  } finally {
    done()
  }
}

const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|avif)\b/i

async function handleImage(url: string, env: Env, h: Record<string, string>): Promise<Response> {
  const timeout = Number(env.FETCH_TIMEOUT_MS) || LIMITS.timeoutMs
  const { res, done } = await download(url, 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9', timeout)
  try {
    const type = res.headers.get('Content-Type') ?? ''
    if (!IMAGE_TYPES.test(type)) { void res.body?.cancel(); throw new Fail('not_html') }
    if (Number(res.headers.get('Content-Length') ?? 0) > LIMITS.maxImageBytes) { void res.body?.cancel(); throw new Fail('too_large') }
    const size = { tooLarge: false }
    let bytes: ArrayBuffer
    try {
      bytes = await new Response(capped(res.body!, LIMITS.maxImageBytes, size)).arrayBuffer()
    } catch (e) {
      if (size.tooLarge) throw new Fail('too_large')
      throw e
    }
    return new Response(bytes, { headers: { ...h, 'Content-Type': type.split(';')[0], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (e) {
    if (e instanceof Fail) throw e
    throw new Fail('upstream_error')
  } finally {
    done()
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'

    // 1. origine: solo quelle consentite (anche per i controlli preliminari del browser)
    if (!originAllowed(origin, env.ALLOWED_ORIGINS)) {
      return request.method === 'OPTIONS' ? new Response(null, { status: 403 }) : failure('forbidden_origin', {})
    }
    const h = cors(origin!)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })

    // 2. limite di richieste per client (conta anche i tentativi con chiave sbagliata)
    if (env.LIMITER) {
      const key = request.headers.get('CF-Connecting-IP') ?? 'sconosciuto'
      if (!(await env.LIMITER.limit({ key })).success) return failure('rate_limited', h)
    }

    // 3. chiave personale, se configurata
    if (env.ACCESS_TOKEN && !safeEqual(request.headers.get('X-Ricettacolo-Key') ?? '', env.ACCESS_TOKEN)) return failure('unauthorized', h)

    if (request.method === 'GET' && path === '/health') return json({ ok: true, service: 'ricettacolo-import' }, 200, h)

    if (request.method === 'POST' && (path === '/recipe' || path === '/image')) {
      let target: unknown
      try {
        const text = await request.text()
        if (text.length > LIMITS.maxBody) return failure('bad_request', h)
        target = (JSON.parse(text) as { url?: unknown }).url
      } catch {
        return failure('bad_request', h)
      }
      const v = validateTarget(target)
      if (!v.ok) return failure(v.reason, h)
      try {
        return path === '/recipe' ? await handleRecipe(v.url.href, env, h) : await handleImage(v.url.href, env, h)
      } catch (e) {
        if (e instanceof Fail) return failure(e.code, h, e.upstreamStatus ? { upstreamStatus: e.upstreamStatus } : {})
        return failure('upstream_error', h)
      }
    }
    return json({ ok: false, error: 'bad_request', message: 'Percorso non trovato.' }, 404, h)
  },
}
