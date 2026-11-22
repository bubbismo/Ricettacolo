import { build } from 'esbuild'
import { Miniflare, Response as MfResponse } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FIXTURES, PNG } from './fixtures'

const ORIGIN = 'https://bubbismo.github.io'
const hits: string[] = []

async function start(extra: Record<string, unknown> = {}, bindings: Record<string, string> = {}) {
  return new Miniflare({
    modules: true,
    scriptPath: 'dist/worker.js',
    compatibilityDate: '2025-11-01',
    bindings: { ALLOWED_ORIGINS: `${ORIGIN}, http://localhost:4173`, FETCH_TIMEOUT_MS: '700', ...bindings },
    // "internet finto": ogni richiesta in uscita del Worker finisce qui
    outboundService: async (req: Request) => {
      hits.push(req.url)
      const fx = FIXTURES[req.url]
      if (!fx) return new MfResponse('non trovato', { status: 404 })
      if (fx.delayMs) await new Promise((r) => setTimeout(r, fx.delayMs))
      return new MfResponse(fx.body as BodyInit, { status: fx.status ?? 200, headers: { 'Content-Type': fx.type ?? 'text/html; charset=utf-8', ...fx.headers } })
    },
    ...extra,
  })
}

let mf: Miniflare
const call = (path: string, body?: unknown, init: RequestInit & { origin?: string | null; key?: string } = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.origin !== null) headers.Origin = init.origin ?? ORIGIN
  if (init.key) headers['X-Ricettacolo-Key'] = init.key
  return mf.dispatchFetch(`https://svc.example${path}`, { method: init.method ?? (body === undefined ? 'GET' : 'POST'), headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
}
const recipe = async (url: string) => { const r = await call('/recipe', { url }); return { status: r.status, body: (await r.json()) as any, res: r } }

beforeAll(async () => {
  await build({ entryPoints: ['src/index.ts'], bundle: true, format: 'esm', outfile: 'dist/worker.js', target: 'es2022', logLevel: 'error' })
  mf = await start()
}, 60000)
afterAll(async () => { await mf?.dispose() })

describe('origine, CORS e percorsi', () => {
  it('health con origine consentita, con intestazioni CORS precise', async () => {
    const r = await call('/health')
    expect(r.status).toBe(200)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(r.headers.get('Access-Control-Allow-Origin')).not.toBe('*')
    expect((await r.json() as any).ok).toBe(true)
  })
  it('senza origine o con origine sbagliata: 403 e nessuna intestazione CORS', async () => {
    for (const origin of [null, 'https://evil.example', 'https://bubbismo.github.io.evil.com']) {
      const r = await call('/health', undefined, { origin })
      expect(r.status).toBe(403)
      expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull()
    }
  })
  it('controllo preliminare del browser (OPTIONS)', async () => {
    const ok = await call('/recipe', undefined, { method: 'OPTIONS' })
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('X-Ricettacolo-Key')
    expect((await call('/recipe', undefined, { method: 'OPTIONS', origin: 'https://evil.example' })).status).toBe(403)
  })
  it('percorso o metodo sconosciuto → 404; corpo non valido → 400', async () => {
    expect((await call('/altro')).status).toBe(404)
    expect((await call('/recipe', 'non json')).status).toBe(400)
    expect((await call('/recipe', { nonurl: 1 })).status).toBe(400)
    expect((await call('/recipe', JSON.stringify({ url: 'https://sito.it/' + 'a'.repeat(5000) }))).status).toBe(400)
  })
})

describe('lettura delle ricette', () => {
  it('JSON-LD: tutti i campi', async () => {
    const { status, body } = await recipe('https://sito.it/jsonld')
    expect(status).toBe(200)
    expect(body.recipe).toMatchObject({
      title: 'Tiramisù classico', ingredients: ['500 g mascarpone', '4 uova', '300 g savoiardi'], steps: ['Monta i tuorli.', 'Componi gli strati.'],
      servings: '6 porzioni', prepMinutes: 30, cookMinutes: null, totalMinutes: 90, image: 'https://cdn.sito.it/tiramisu.jpg', site: 'Sito Ricette', url: 'https://sito.it/jsonld',
    })
  })
  it('@graph, @type come elenco, sezioni, entità, numeri', async () => {
    const { body } = await recipe('https://sito.it/graph')
    expect(body.recipe).toMatchObject({ title: 'Pasta & fagioli', servings: '4', cookMinutes: 45, steps: ['## Il soffritto', 'Taglia la cipolla', '## La cottura', 'Cuoci 20 minuti'], site: 'sito.it' })
  })
  it('più blocchi script, alcuni rotti', async () => {
    expect((await recipe('https://sito.it/multi')).body.recipe.title).toBe('Terza')
  })
  it('microdata completi (autore ignorato, passaggi annidati, tempi da meta/time, immagine)', async () => {
    const { body } = await recipe('https://sito.it/micro')
    expect(body.recipe).toMatchObject({
      title: 'Torta di mele', ingredients: ['3 mele', '200 g farina'], steps: ['Sbuccia le mele', 'Cuoci in forno'],
      prepMinutes: 20, cookMinutes: 40, servings: '8 fette', image: 'https://sito.it/img/torta.jpg',
    })
  })
  it('microdata semplici (ingredients, br nei passaggi)', async () => {
    const { body } = await recipe('https://sito.it/micro-semplice')
    expect(body.recipe).toMatchObject({ title: 'Frittata', ingredients: ['4 uova', 'sale'], steps: ['Sbatti le uova.', 'Cuoci in padella.'] })
  })
  it('nessuna ricetta: errore chiaro con titolo, sito e immagine della pagina', async () => {
    const { status, body } = await recipe('https://sito.it/nessuna')
    expect(status).toBe(422)
    expect(body).toMatchObject({ ok: false, error: 'no_recipe', message: expect.stringContaining('Nessuna ricetta'), hints: { title: 'Un articolo qualunque', site: 'Il Blog', image: 'https://sito.it/img/og.jpg' } })
  })
  it('pagina non UTF-8 (iso-8859-1)', async () => {
    expect((await recipe('https://sito.it/latin1')).body.recipe.title).toBe('Caffè e cornetto')
  })
  it('segue i reindirizzamenti (fino a 3) e indica l\'indirizzo finale', async () => {
    const { body } = await recipe('https://sito.it/r1')
    expect(body.recipe).toMatchObject({ title: 'Dopo i reindirizzamenti', url: 'https://altro.it/jsonld' })
    expect((await recipe('https://sito.it/lunga-catena-2')).status).toBe(200) // 3 reindirizzamenti: ok
    expect((await recipe('https://sito.it/lunga-catena-1')).body.error).toBe('upstream_error') // 4: troppi
  })
})

describe('limiti e sicurezza', () => {
  it('pagina enorme con la ricetta in cima: si ferma in anticipo e funziona', async () => {
    const { status, body } = await recipe('https://sito.it/grande-con-ricetta')
    expect(status).toBe(200)
    expect(body.recipe.title).toBe('Tiramisù classico')
  })
  it('pagina enorme senza ricetta: 413', async () => {
    expect((await recipe('https://sito.it/grande-senza')).body).toMatchObject({ ok: false, error: 'too_large' })
  })
  it('contenuto non HTML: 415; pagina inesistente: 502 con il codice del sito', async () => {
    expect((await recipe('https://sito.it/pdf')).status).toBe(415)
    const nf = await recipe('https://sito.it/404')
    expect(nf.status).toBe(502)
    expect(nf.body).toMatchObject({ error: 'upstream_error', upstreamStatus: 404 })
  })
  it('sito troppo lento: 504', async () => {
    expect((await recipe('https://sito.it/lenta')).body).toMatchObject({ ok: false, error: 'timeout' })
  })
  it('indirizzi interni, locali e non http: rifiutati senza nemmeno contattarli', async () => {
    hits.length = 0
    for (const u of ['http://localhost/', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://10.0.0.1/', 'http://metadata.google.internal/', 'http://sito.it:8080/x', 'http://u:p@sito.it/'])
      expect([u, (await recipe(u)).status]).toEqual([u, 403])
    for (const u of ['file:///etc/passwd', 'ftp://sito.it/x', 'javascript:alert(1)', 'boh']) expect([u, (await recipe(u)).status]).toEqual([u, 400])
    expect(hits).toEqual([])
  })
  it('reindirizzamento verso un indirizzo interno: ricontrollato e fermato; cicli e catene troppo lunghe: errore', async () => {
    hits.length = 0
    expect((await recipe('https://sito.it/verso-metadata')).body.error).toBe('blocked')
    expect((await recipe('https://sito.it/verso-localhost')).body.error).toBe('blocked')
    expect(hits.map((h) => new URL(h).hostname).filter((h) => h.startsWith('169.254') || h === 'localhost')).toEqual([])
    expect((await recipe('https://sito.it/ciclo')).body.error).toBe('upstream_error')
  })
})

describe('immagine (solo su richiesta)', () => {
  const image = (url: string) => call('/image', { url })
  it('restituisce i byte e il tipo, con CORS', async () => {
    const r = await image('https://cdn.sito.it/tiramisu.png')
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('image/png')
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PNG)
  })
  it('rifiuta SVG, dimensioni eccessive, pagine travestite e indirizzi interni', async () => {
    expect((await image('https://cdn.sito.it/vettore.svg')).status).toBe(415)
    expect((await image('https://cdn.sito.it/enorme.jpg')).status).toBe(413)
    expect((await image('https://sito.it/jsonld')).status).toBe(415)
    expect((await image('http://127.0.0.1/a.png')).status).toBe(403)
  })
})

describe('chiave personale e limite di richieste', () => {
  it('con ACCESS_TOKEN: senza chiave o con chiave sbagliata 401, con chiave giusta ok', async () => {
    const secured = await start({}, { ACCESS_TOKEN: 'segreto-di-famiglia' })
    const go = (key?: string) => secured.dispatchFetch('https://svc.example/health', { headers: { Origin: ORIGIN, ...(key ? { 'X-Ricettacolo-Key': key } : {}) } })
    expect((await go()).status).toBe(401)
    expect((await go('sbagliata')).status).toBe(401)
    expect((await go('segreto-di-famiglia')).status).toBe(200)
    await secured.dispose()
  })
  it('oltre il limite: 429', async () => {
    const limited = await start({ ratelimits: { LIMITER: { namespace_id: '1001', simple: { limit: 3, period: 60 } } } })
    const codes: number[] = []
    for (let i = 0; i < 5; i++) codes.push((await limited.dispatchFetch('https://svc.example/health', { headers: { Origin: ORIGIN } })).status)
    expect(codes.slice(0, 3)).toEqual([200, 200, 200])
    expect(codes.slice(3)).toEqual([429, 429])
    await limited.dispose()
  })
})
