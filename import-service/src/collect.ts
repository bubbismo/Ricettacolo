import { hasUsableJsonLd } from './extract'
import type { Collected, MicroEntry } from './types'

const VOID = new Set(['meta', 'link', 'img', 'source', 'area', 'base', 'br', 'col', 'embed', 'hr', 'input', 'param', 'track', 'wbr'])
const RECIPE_TYPE = /schema\.org\/Recipe\b/i
/** Tipi annidati "trasparenti": i passaggi (HowToStep…) fanno parte della ricetta. Gli altri (autore, voti, nutrizione…) no. */
const TRANSPARENT = /HowTo|ListItem|ItemList/i

interface Open { entries: MicroEntry[] }

/**
 * Raccoglie dalla pagina, con l'HTMLRewriter di Cloudflare (a flusso, nativo, leggero sul tempo di calcolo):
 * i blocchi JSON-LD, i microdata della ricetta, titolo e immagine della pagina. `isDone()` diventa vero appena
 * si è trovata una ricetta completa nel JSON-LD: chi legge la pagina può smettere di scaricarla.
 */
export function createCollector(pageUrl: string) {
  const c: Collected = { jsonLd: [], micro: [], og: {} }
  let done = false
  let ldCapture = false
  let ldBuf = ''
  let titleSeen = false
  let inRecipe = false
  let nested = 0
  const stack: Open[] = []

  const meta = (key: 'title' | 'image' | 'siteName') => ({
    element(el: Element) { const v = el.getAttribute('content'); if (v && !c.og[key]) c.og[key] = v },
  })

  const newline = () => {
    const top = stack[stack.length - 1]
    if (top) for (const e of top.entries) e.value += '\n'
  }

  const rewriter = new HTMLRewriter()
    .on('title', {
      text(t) { if (!titleSeen) { c.htmlTitle = (c.htmlTitle ?? '') + t.text; if (t.lastInTextNode) titleSeen = true } },
    })
    .on('meta[property="og:title"]', meta('title'))
    .on('meta[property="og:image"]', meta('image'))
    .on('meta[name="twitter:image"]', meta('image'))
    .on('meta[property="og:site_name"]', meta('siteName'))
    .on('script', {
      element(el) {
        if ((el.getAttribute('type') ?? '').toLowerCase().includes('ld+json')) {
          ldCapture = true
          ldBuf = ''
          el.onEndTag(() => { ldCapture = false })
        }
      },
      text(t) {
        if (!ldCapture) return
        ldBuf += t.text
        if (t.lastInTextNode) {
          c.jsonLd.push(ldBuf)
          if (!done && ldBuf.includes('Recipe') && hasUsableJsonLd(ldBuf, pageUrl)) done = true
          ldBuf = ''
        }
      },
    })
    // ---- microdata (ripiego se non c'è JSON-LD) ----
    .on('[itemscope]', {
      element(el) {
        const type = el.getAttribute('itemtype') ?? ''
        if (!inRecipe && RECIPE_TYPE.test(type)) {
          inRecipe = true
          el.onEndTag(() => { inRecipe = false })
        } else if (inRecipe && !TRANSPARENT.test(type)) {
          nested++
          el.onEndTag(() => { nested-- })
        }
      },
    })
    .on('[itemprop]', {
      element(el) {
        if (!inRecipe || nested > 0) return
        const tag = el.tagName.toLowerCase()
        const names = (el.getAttribute('itemprop') ?? '').split(/\s+/).filter(Boolean)
        let value: string | null = el.getAttribute('content')
        if (value === null) {
          if (tag === 'time' || tag === 'data') value = el.getAttribute('datetime') ?? el.getAttribute('value')
          else if (tag === 'img' || tag === 'source' || tag === 'iframe') value = el.getAttribute('src')
          else if (tag === 'a' || tag === 'link' || tag === 'area') value = el.getAttribute('href')
          else if (tag === 'meta') value = ''
        }
        const parentOpen = stack[stack.length - 1]
        if (parentOpen) for (const e of parentOpen.entries) e.hasChild = true
        const parent = parentOpen?.entries[0]?.name ?? null
        const entries: MicroEntry[] = names.map((name) => ({ name, value: value ?? '', parent, hasChild: false }))
        c.micro.push(...entries)
        if (value === null && !VOID.has(tag) && entries.length) {
          const open: Open = { entries }
          stack.push(open)
          el.onEndTag(() => { const i = stack.indexOf(open); if (i >= 0) stack.splice(i, 1) })
        }
      },
      text(t) {
        const top = stack[stack.length - 1]
        if (top) for (const e of top.entries) e.value += t.text
      },
    })
    // <br> e fine di paragrafo/elenco dentro un valore: vanno a capo (altrimenti le frasi si incollano)
    .on('br', { element() { newline() } })
    .on('p, li, div, tr', { element(el) { el.onEndTag(newline) } })

  return { rewriter, collected: c, isDone: () => done }
}
