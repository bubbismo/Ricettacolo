export interface Fx { status?: number; type?: string; body: string | Uint8Array; headers?: Record<string, string>; delayMs?: number }

const recipeLd = (extra: Record<string, unknown> = {}) => JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Recipe', name: 'Tiramisù classico', recipeIngredient: ['500 g mascarpone', '4 uova', '300 g savoiardi'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Monta i tuorli.' }, { '@type': 'HowToStep', text: 'Componi gli strati.' }],
  recipeYield: ['6', '6 porzioni'], prepTime: 'PT30M', totalTime: 'PT1H30M', image: ['https://cdn.sito.it/tiramisu.jpg'], ...extra,
})

export const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))

const html = (head: string, body = '') => `<!doctype html><html><head><meta charset="utf-8"><title>Pagina</title>${head}</head><body>${body}</body></html>`

const big = (n: number) => 'x'.repeat(n)

export const FIXTURES: Record<string, Fx> = {
  'https://sito.it/jsonld': { body: html(`<meta property="og:site_name" content="Sito Ricette"><script type="application/ld+json">${recipeLd()}</script>`) },
  'https://sito.it/graph': {
    body: html(`<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"S"},{"@type":["Recipe","Article"],"name":"Pasta &amp; fagioli","recipeIngredient":["200 g pasta","1 cipolla"],"recipeInstructions":[{"@type":"HowToSection","name":"Il soffritto","itemListElement":[{"@type":"HowToStep","text":"Taglia la cipolla"}]},{"@type":"HowToSection","name":"La cottura","itemListElement":[{"@type":"HowToStep","text":"Cuoci 20 minuti"}]}],"recipeYield":4,"cookTime":"PT45M"}]}</script>`),
  },
  'https://sito.it/multi': {
    body: html(`<script type="application/ld+json">{ rotto</script><script type="application/ld+json">{"@type":"BreadcrumbList"}</script><script type="application/ld+json">${recipeLd({ name: 'Terza' })}</script>`),
  },
  'https://sito.it/micro': {
    body: html('', `<div itemscope itemtype="https://schema.org/Recipe">
      <h1 itemprop="name">Torta di mele</h1>
      <span itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">Anna Rossi</span></span>
      <meta itemprop="prepTime" content="PT20M"><time itemprop="cookTime" datetime="PT40M">40 min</time>
      <span itemprop="recipeYield">8 fette</span><img itemprop="image" src="/img/torta.jpg">
      <ul><li itemprop="recipeIngredient">3 mele</li><li itemprop="recipeIngredient"><span>200 g</span> farina</li></ul>
      <ol itemprop="recipeInstructions"><li itemprop="itemListElement" itemscope itemtype="https://schema.org/HowToStep"><span itemprop="text">Sbuccia le mele</span></li>
      <li itemprop="itemListElement" itemscope itemtype="https://schema.org/HowToStep"><span itemprop="text">Cuoci in forno</span></li></ol></div>`),
  },
  'https://sito.it/micro-semplice': {
    body: html('', `<div itemscope itemtype="http://schema.org/Recipe"><h1 itemprop="name">Frittata</h1>
      <p itemprop="ingredients">4 uova</p><p itemprop="ingredients">sale</p><div itemprop="recipeInstructions">Sbatti le uova.<br>Cuoci in padella.</div></div>`),
  },
  'https://sito.it/nessuna': { body: html('<meta property="og:title" content="Un articolo qualunque"><meta property="og:image" content="/img/og.jpg"><meta property="og:site_name" content="Il Blog">', '<p>Niente ricetta</p>') },
  'https://sito.it/latin1': {
    type: 'text/html; charset=iso-8859-1',
    body: Uint8Array.from(Buffer.from(`<html><head><script type="application/ld+json">{"@type":"Recipe","name":"Caffè e cornetto","recipeIngredient":["1 tazza di caffè"]}</script></head></html>`, 'latin1')),
  },
  'https://sito.it/grande-con-ricetta': { body: html(`<script type="application/ld+json">${recipeLd()}</script>`) + big(3 * 1024 * 1024) },
  'https://sito.it/grande-senza': { body: html('<meta property="og:title" content="x">') + big(3 * 1024 * 1024) },
  'https://sito.it/pdf': { type: 'application/pdf', body: '%PDF-1.4' },
  'https://sito.it/404': { status: 404, body: 'non trovata' },
  'https://sito.it/lenta': { body: html(''), delayMs: 3000 },
  'https://sito.it/r1': { status: 301, body: '', headers: { Location: '/r2' } },
  'https://sito.it/r2': { status: 302, body: '', headers: { Location: 'https://altro.it/jsonld' } },
  'https://altro.it/jsonld': { body: html(`<script type="application/ld+json">${recipeLd({ name: 'Dopo i reindirizzamenti' })}</script>`) },
  'https://sito.it/verso-metadata': { status: 302, body: '', headers: { Location: 'http://169.254.169.254/latest/meta-data/' } },
  'https://sito.it/verso-localhost': { status: 302, body: '', headers: { Location: 'http://localhost:8787/' } },
  'https://sito.it/ciclo': { status: 302, body: '', headers: { Location: '/ciclo2' } },
  'https://sito.it/ciclo2': { status: 302, body: '', headers: { Location: '/ciclo' } },
  'https://sito.it/lunga-catena-1': { status: 302, body: '', headers: { Location: '/lunga-catena-2' } },
  'https://sito.it/lunga-catena-2': { status: 302, body: '', headers: { Location: '/lunga-catena-3' } },
  'https://sito.it/lunga-catena-3': { status: 302, body: '', headers: { Location: '/lunga-catena-4' } },
  'https://sito.it/lunga-catena-4': { status: 302, body: '', headers: { Location: '/jsonld' } },
  'https://cdn.sito.it/tiramisu.png': { type: 'image/png', body: PNG },
  'https://cdn.sito.it/tiramisu.jpg': { type: 'image/png', body: PNG },
  'https://cdn.sito.it/vettore.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
  'https://cdn.sito.it/enorme.jpg': { type: 'image/jpeg', body: new Uint8Array(7 * 1024 * 1024) },
  'https://cdn.sito.it/finta.png': { type: 'image/png', body: '<html>non sono un\'immagine</html>' },
}
