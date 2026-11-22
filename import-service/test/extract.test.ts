import { describe, expect, it } from 'vitest'
import { buildResult, cleanText, decodeEntities, parseDuration, parseYield, recipeFromJsonLd, recipeFromMicrodata, stepsOf } from '../src/extract'
import type { Collected } from '../src/types'

const URL_ = 'https://www.sito.it/ricette/tiramisu'
const ld = (o: unknown) => JSON.stringify(o)
const collected = (over: Partial<Collected> = {}): Collected => ({ jsonLd: [], micro: [], og: {}, ...over })

describe('durate ISO 8601', () => {
  it('converte in minuti', () => {
    expect(parseDuration('PT1H30M')).toBe(90)
    expect(parseDuration('PT45M')).toBe(45)
    expect(parseDuration('PT2H')).toBe(120)
    expect(parseDuration('P1DT2H')).toBe(1560)
    expect(parseDuration('PT90S')).toBe(2)
    expect(parseDuration('pt15m')).toBe(15)
    expect(parseDuration('PT0S')).toBeNull()
    expect(parseDuration('P0D')).toBeNull()
    expect(parseDuration('boh')).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
    expect(parseDuration('30')).toBe(30)
    expect(parseDuration(25)).toBe(25)
  })
})

describe('porzioni', () => {
  it('numero, testo o elenco', () => {
    expect(parseYield(4)).toBe('4')
    expect(parseYield('4 persone')).toBe('4 persone')
    expect(parseYield(['4', '4 porzioni'])).toBe('4 porzioni')
    expect(parseYield(['6'])).toBe('6')
    expect(parseYield([])).toBeNull()
    expect(parseYield(undefined)).toBeNull()
  })
})

describe('testo', () => {
  it('decodifica le entità e toglie i tag', () => {
    expect(decodeEntities('Pasta &amp; fagioli, caff&egrave; &#232; &#x2019;')).toBe("Pasta & fagioli, caffè è ’")
    expect(decodeEntities('&nonesiste; &#0; &#xD800;')).toBe('&nonesiste;  ')
    expect(cleanText('Mescola<br/>poi&nbsp;inforna <b>bene</b>')).toBe('Mescola\npoi inforna bene')
    expect(cleanText('&lt;p&gt;Uno&lt;/p&gt;&lt;p&gt;Due&lt;/p&gt;')).toBe('Uno\nDue')
  })
})

describe('passaggi', () => {
  it('testo con a capo, numerazione tolta', () => {
    expect(stepsOf('1. Taglia\n2. Cuoci\n\n3) Servi')).toEqual(['Taglia', 'Cuoci', 'Servi'])
  })
  it('elenco di stringhe', () => expect(stepsOf(['Uno', 'Due'])).toEqual(['Uno', 'Due']))
  it('HowToStep con text oppure con solo name', () => {
    expect(stepsOf([{ '@type': 'HowToStep', text: 'Taglia' }, { '@type': 'HowToStep', name: 'Cuoci' }])).toEqual(['Taglia', 'Cuoci'])
  })
  it('HowToSection annidate con intestazioni', () => {
    const x = [
      { '@type': 'HowToSection', name: 'Per la crema', itemListElement: [{ '@type': 'HowToStep', text: 'Monta i tuorli' }, { '@type': 'HowToStep', text: 'Aggiungi il mascarpone' }] },
      { '@type': 'HowToSection', name: 'Montaggio', itemListElement: { '@type': 'HowToStep', text: 'Componi gli strati' } },
    ]
    expect(stepsOf(x)).toEqual(['## Per la crema', 'Monta i tuorli', 'Aggiungi il mascarpone', '## Montaggio', 'Componi gli strati'])
  })
  it('ItemList e HTML dentro il testo', () => {
    expect(stepsOf({ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', text: '<p>Uno</p><p>Due &amp; tre</p>' }] })).toEqual(['Uno', 'Due & tre'])
  })
})

describe('JSON-LD', () => {
  const recipe = {
    '@type': 'Recipe', name: 'Tiramisù &amp; co', recipeIngredient: ['500 g mascarpone', '4 uova'],
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Monta' }, { '@type': 'HowToStep', text: 'Componi' }],
    recipeYield: 6, prepTime: 'PT30M', cookTime: 'PT0M', totalTime: 'PT1H30M', image: ['/img/t.jpg'], publisher: { name: 'Sito Ricette' },
  }
  it('Recipe semplice', () => {
    const r = recipeFromJsonLd([ld({ '@context': 'https://schema.org', ...recipe })], URL_)!
    expect(r).toMatchObject({ title: 'Tiramisù & co', ingredients: ['500 g mascarpone', '4 uova'], steps: ['Monta', 'Componi'], servings: '6', prepMinutes: 30, cookMinutes: null, totalMinutes: 90, image: 'https://www.sito.it/img/t.jpg', site: 'Sito Ricette' })
  })
  it('dentro @graph con altri nodi', () => {
    const r = recipeFromJsonLd([ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'X' }, { '@type': 'Organization', name: 'Y' }, recipe] })], URL_)!
    expect(r.title).toBe('Tiramisù & co')
  })
  it('@type come elenco e come URL completo', () => {
    expect(recipeFromJsonLd([ld({ ...recipe, '@type': ['Recipe', 'Article'] })], URL_)!.title).toBe('Tiramisù & co')
    expect(recipeFromJsonLd([ld({ ...recipe, '@type': 'https://schema.org/Recipe' })], URL_)!.title).toBe('Tiramisù & co')
  })
  it('più blocchi script, di cui alcuni rotti o non ricette', () => {
    const r = recipeFromJsonLd(['{ non json', ld({ '@type': 'BreadcrumbList' }), ld(recipe)], URL_)!
    expect(r.ingredients).toHaveLength(2)
  })
  it('array di nodi al livello più alto e Recipe annidata in mainEntity', () => {
    expect(recipeFromJsonLd([ld([{ '@type': 'WebPage' }, recipe])], URL_)!.title).toBe('Tiramisù & co')
    expect(recipeFromJsonLd([ld({ '@type': 'WebPage', mainEntity: recipe })], URL_)!.title).toBe('Tiramisù & co')
  })
  it('istruzioni come testo, ingredienti come testo unico, immagine come oggetto', () => {
    const r = recipeFromJsonLd([ld({ '@type': 'Recipe', name: 'X', recipeIngredient: '200 g farina\n2 uova', recipeInstructions: 'Impasta.\nCuoci.', image: { '@type': 'ImageObject', url: 'https://cdn.it/a.jpg' }, recipeYield: ['4', '4 porzioni'] })], URL_)!
    expect(r).toMatchObject({ ingredients: ['200 g farina', '2 uova'], steps: ['Impasta.', 'Cuoci.'], image: 'https://cdn.it/a.jpg', servings: '4 porzioni' })
  })
  it('newline grezzi dentro le stringhe del JSON (frequenti nelle pagine reali)', () => {
    const raw = '{"@type":"Recipe","name":"Rotta","recipeIngredient":["a\nb"],"recipeInstructions":"Passo uno"}'
    const r = recipeFromJsonLd([raw], URL_)!
    expect(r.title).toBe('Rotta')
    expect(r.steps).toEqual(['Passo uno'])
  })
  it('immagini non http sono scartate', () => {
    expect(recipeFromJsonLd([ld({ ...recipe, image: 'javascript:alert(1)' })], URL_)!.image).toBeNull()
  })
  it('sceglie la ricetta più completa', () => {
    const poor = { '@type': 'Recipe', name: 'Povera' }
    expect(recipeFromJsonLd([ld([poor, recipe])], URL_)!.title).toBe('Tiramisù & co')
  })
  it('limiti di lunghezza', () => {
    const big = { '@type': 'Recipe', name: 'x'.repeat(500), recipeIngredient: Array.from({ length: 300 }, (_, i) => `ing ${i}`), recipeInstructions: ['y'.repeat(9000)] }
    const r = recipeFromJsonLd([ld(big)], URL_)!
    expect(r.title.length).toBe(200)
    expect(r.ingredients).toHaveLength(120)
    expect(r.steps[0].length).toBe(3000)
  })
})

describe('microdata', () => {
  it('ricostruisce la ricetta dalle voci raccolte', () => {
    const r = recipeFromMicrodata([
      { name: 'name', value: 'Torta', parent: null, hasChild: false },
      { name: 'recipeIngredient', value: '200 g farina', parent: null, hasChild: false },
      { name: 'recipeIngredient', value: '2 uova', parent: null, hasChild: false },
      { name: 'recipeInstructions', value: '', parent: null, hasChild: true },
      { name: 'text', value: 'Impasta', parent: 'recipeInstructions', hasChild: false },
      { name: 'text', value: 'Cuoci', parent: 'recipeInstructions', hasChild: false },
      { name: 'prepTime', value: 'PT15M', parent: null, hasChild: false },
      { name: 'recipeYield', value: '8 fette', parent: null, hasChild: false },
      { name: 'name', value: 'Autore', parent: 'author', hasChild: false },
    ], URL_)!
    expect(r).toMatchObject({ title: 'Torta', ingredients: ['200 g farina', '2 uova'], steps: ['Impasta', 'Cuoci'], prepMinutes: 15, servings: '8 fette' })
  })
  it('passaggi come paragrafi semplici', () => {
    const r = recipeFromMicrodata([{ name: 'recipeIngredient', value: 'x', parent: null, hasChild: false }, { name: 'recipeInstructions', value: 'Uno\nDue', parent: null, hasChild: false }], URL_)!
    expect(r.steps).toEqual(['Uno', 'Due'])
  })
  it('niente di utile → null', () => expect(recipeFromMicrodata([], URL_)).toBeNull())
})

describe('buildResult', () => {
  it('preferisce JSON-LD; sito dal nome del sito o dal dominio', () => {
    const b = buildResult(collected({ jsonLd: [ld({ '@type': 'Recipe', name: 'A', recipeIngredient: ['x'] })], og: { siteName: 'Il Mio Sito' } }), URL_)
    expect('recipe' in b && b.recipe).toMatchObject({ title: 'A', site: 'Il Mio Sito', url: URL_ })
    const c = buildResult(collected({ jsonLd: [ld({ '@type': 'Recipe', name: 'A', recipeIngredient: ['x'] })] }), URL_)
    expect('recipe' in c && c.recipe.site).toBe('sito.it')
  })
  it('nome del sito troppo lungo: si usa il dominio', () => {
    const b = buildResult(collected({ jsonLd: [ld({ '@type': 'Recipe', name: 'A', recipeIngredient: ['x'] })], og: { siteName: 'Ricette di cucina - Le Ricette di GialloZafferano.it, il sito di cucina' } }), URL_)
    expect('recipe' in b && b.recipe.site).toBe('sito.it')
  })
  it('titolo e immagine di ripiego dalla pagina', () => {
    const b = buildResult(collected({ jsonLd: [ld({ '@type': 'Recipe', recipeIngredient: ['x'] })], og: { title: 'Titolo pagina', image: '/og.jpg' } }), URL_)
    expect('recipe' in b && b.recipe).toMatchObject({ title: 'Titolo pagina', image: 'https://www.sito.it/og.jpg' })
  })
  it('senza ricetta strutturata: solo suggerimenti (titolo, sito, immagine)', () => {
    const b = buildResult(collected({ og: { title: 'Pagina qualunque', image: 'https://cdn.it/i.jpg', siteName: 'Sito' } }), URL_)
    expect(b).toEqual({ hints: { title: 'Pagina qualunque', site: 'Sito', image: 'https://cdn.it/i.jpg' } })
  })
  it('una Recipe vuota (solo nome) non è una ricetta', () => {
    const b = buildResult(collected({ jsonLd: [ld({ '@type': 'Recipe', name: 'Solo nome' })] }), URL_)
    expect('hints' in b && b.hints.title).toBe('Solo nome')
  })
  it('ripiega sui microdata se il JSON-LD non ha ricetta', () => {
    const b = buildResult(collected({ jsonLd: [ld({ '@type': 'WebSite' })], micro: [{ name: 'name', value: 'Micro', parent: null, hasChild: false }, { name: 'recipeIngredient', value: 'x', parent: null, hasChild: false }] }), URL_)
    expect('recipe' in b && b.recipe.title).toBe('Micro')
  })
})
