import { describe, expect, it } from 'vitest'
import { formatMinutes, ingredientName, mainIngredients, parsedToDraft, recipeText, remoteToDraft, sanitizeHints, sanitizeRemote, timesLine } from './importMap'
import { normalizeServiceUrl, importErrorMessage } from './importService'
import { parseRecipeText } from './recipeText'
import { interpretShare } from './share'

describe('sanitizeRemote: non ci si fida del servizio', () => {
  it('accetta una ricetta valida', () => {
    const r = sanitizeRemote({ title: ' Tiramisù ', ingredients: ['500 g mascarpone', ''], steps: ['Monta'], servings: '6', prepMinutes: 30, cookMinutes: null, totalMinutes: 90, image: 'https://cdn.it/a.jpg', site: 'Sito', url: 'https://sito.it/t' })
    expect(r).toMatchObject({ title: 'Tiramisù', ingredients: ['500 g mascarpone'], servings: '6', prepMinutes: 30, cookMinutes: null, image: 'https://cdn.it/a.jpg' })
  })
  it('un passo valido basta a farne una ricetta', () => {
    const r = sanitizeRemote({ title: '', ingredients: [], steps: ['ok'], image: 'javascript:alert(1)', url: 'ftp://x', prepMinutes: -3, totalMinutes: 1e9 })!
    expect(r).toMatchObject({ steps: ['ok'], image: null, url: '', prepMinutes: null, totalMinutes: null })
  })
  it('non-oggetti → null; limiti di lunghezza', () => {
    expect(sanitizeRemote(null)).toBeNull()
    expect(sanitizeRemote('x')).toBeNull()
    expect(sanitizeRemote({ title: 'x'.repeat(900), ingredients: Array(500).fill('a') })!.title).toHaveLength(200)
    expect(sanitizeRemote({ title: 'x', ingredients: Array(500).fill('a') })!.ingredients).toHaveLength(150)
  })
  it('suggerimenti', () => {
    expect(sanitizeHints({ title: 'T', site: 'S', image: 'javascript:x' })).toEqual({ title: 'T', site: 'S' })
    expect(sanitizeHints({})).toBeUndefined()
  })
})

describe('porzioni e tempi', () => {
  it('formatta i minuti', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(90)).toBe('1 h 30 min')
  })
  it('riga per le Note', () => {
    expect(timesLine({ servings: '4', prepMinutes: 20, cookMinutes: 40, totalMinutes: 60 })).toBe('Porzioni: 4 · Preparazione: 20 min · Cottura: 40 min · Totale: 1 h')
    expect(timesLine({ servings: '6 porzioni', prepMinutes: null, cookMinutes: null, totalMinutes: 90 })).toBe('6 porzioni · Totale: 1 h 30 min')
    expect(timesLine({ servings: null, prepMinutes: null, cookMinutes: null, totalMinutes: null })).toBe('')
  })
})

describe('nomi degli ingredienti', () => {
  const cases: [string, string][] = [
    ['500 g mascarpone', 'mascarpone'], ['Mascarpone 1 kg', 'Mascarpone'], ['Savoiardi (circa 42 pezzi) 350 g', 'Savoiardi'], ['4 uova', 'uova'],
    ['2 cucchiai di zucchero', 'zucchero'], ['sale q.b.', 'sale'], ['1/2 limone', 'limone'], ['un pizzico di sale', 'sale'], ['olio extravergine di oliva q.b.', 'olio extravergine di oliva'],
    ['Farina 00 200 g', 'Farina 00'], ['- 3 mele', 'mele'], ['1,5 l di latte', 'latte'], ['mezzo bicchiere di vino', 'vino'], ['200 g di farina 00', 'farina 00'],
  ]
  for (const [i, o] of cases) it(`${i} → ${o}`, () => expect(ingredientName(i)).toBe(o))
  it('elenco breve, senza doppioni e senza intestazioni', () => {
    expect(mainIngredients(['## Per la crema', '500 g mascarpone', '4 uova', 'Uova 2', 'zucchero q.b.'])).toBe('mascarpone, uova, zucchero')
  })
})

describe('testo completo e bozza', () => {
  it('Ingredienti + Preparazione numerata, sezioni senza numero', () => {
    expect(recipeText(['## Crema', '500 g mascarpone', '4 uova'], ['## Passi', 'Monta', 'Componi'])).toBe(
      'Ingredienti\nCrema:\n- 500 g mascarpone\n- 4 uova\n\nPreparazione\nPassi:\n1. Monta\n2. Componi')
  })
  it('da ricetta letta dal web', () => {
    const d = remoteToDraft({ title: 'Tiramisù', ingredients: ['500 g mascarpone'], steps: ['Monta'], servings: '6', prepMinutes: 30, cookMinutes: null, totalMinutes: null, image: null, site: 'Sito', url: 'https://sito.it/t' })
    expect(d).toMatchObject({ title: 'Tiramisù', source: 'Sito', link: 'https://sito.it/t', mainIngredients: 'mascarpone', notes: 'Porzioni: 6 · Preparazione: 30 min' })
    expect(d.text).toContain('Ingredienti')
    expect(d.text).toContain('1. Monta')
  })
})

describe('importService', () => {
  it('indirizzo del servizio: solo https (o localhost), senza barra finale', () => {
    expect(normalizeServiceUrl(' https://ricettacolo-import.mio.workers.dev/ ')).toBe('https://ricettacolo-import.mio.workers.dev')
    expect(normalizeServiceUrl('http://localhost:8787')).toBe('http://localhost:8787')
    expect(normalizeServiceUrl('http://sito.it')).toBe('')
    expect(normalizeServiceUrl('boh')).toBe('')
    expect(normalizeServiceUrl('')).toBe('')
  })
  it('messaggio per ogni errore', () => expect(importErrorMessage('timeout')).toMatch(/lentamente/))
})

describe('parseRecipeText', () => {
  it('con titoli Ingredienti e Preparazione', () => {
    const p = parseRecipeText(`Tiramisù della nonna

Ingredienti:
- 500 g di mascarpone
- 4 uova
300 g di savoiardi

Preparazione
1. Montare i tuorli con lo zucchero.
2. Aggiungere il mascarpone e mescolare.`)
    expect(p).toMatchObject({ confident: true, title: 'Tiramisù della nonna' })
    expect(p.ingredients).toEqual(['500 g di mascarpone', '4 uova', '300 g di savoiardi'])
    expect(p.steps).toEqual(['Montare i tuorli con lo zucchero.', 'Aggiungere il mascarpone e mescolare.'])
  })
  it('titoli alternativi, in maiuscolo, con "per 4 persone", e gruppi', () => {
    const p = parseRecipeText(`TORTA DI MELE\nINGREDIENTI (per 4 persone)\nPer l'impasto:\n200 g farina\n3 mele\nPROCEDIMENTO\nSbucciare le mele.\nInfornare a 180 gradi.`)
    expect(p.ingredients).toEqual(["## Per l'impasto", '200 g farina', '3 mele'])
    expect(p.steps).toEqual(['Sbucciare le mele.', 'Infornare a 180 gradi.'])
    for (const h of ['Istruzioni', 'Metodo', 'Esecuzione', 'Come si prepara']) {
      expect(parseRecipeText(`Ingredienti\n2 uova\n${h}\nSbatti bene tutto insieme.`).steps).toEqual(['Sbatti bene tutto insieme.'])
    }
  })
  it('ingredienti sulla stessa riga del titolo', () => {
    const p = parseRecipeText('Frittata\nIngredienti: 4 uova, sale, 1 cipolla\nPreparazione: sbatti le uova e cuoci in padella')
    expect(p.ingredients).toEqual(['4 uova', 'sale', '1 cipolla'])
    expect(p.steps).toEqual(['sbatti le uova e cuoci in padella'])
  })
  it('senza titoli: riconosce le righe con quantità', () => {
    const p = parseRecipeText(`Pasta al limone\n200 g spaghetti\n1 limone\nolio q.b.\nsale 1 pizzico\nCuocere la pasta in acqua salata e condirla con il succo di limone e l'olio.`)
    expect(p.confident).toBe(true)
    expect(p.title).toBe('Pasta al limone')
    expect(p.ingredients).toHaveLength(4)
    expect(p.steps[0]).toContain('Cuocere la pasta')
  })
  it('solo ingredienti con titolo e senza "Preparazione": il paragrafo lungo dopo la riga vuota è il procedimento', () => {
    const p = parseRecipeText('Ingredienti\n2 uova\n100 g zucchero\n\nSbattere le uova con lo zucchero fino a ottenere un composto chiaro e spumoso.')
    expect(p.ingredients).toEqual(['2 uova', '100 g zucchero'])
    expect(p.steps).toHaveLength(1)
  })
  it('un testo qualunque NON viene scambiato per una ricetta', () => {
    for (const t of [
      'Ciao, ti passo la ricetta domani così la provi: ti piacerà.',
      'Ingredienti freschi e di stagione sono la base della buona cucina italiana.\nPreparazione e pazienza fanno il resto.',
      'Appuntamento alle 18 con 3 amici\nPortare 2 bottiglie',
      '', 'una riga sola',
    ]) expect(parseRecipeText(t).confident, t).toBe(false)
  })
})

describe('interpretShare (con riconoscimento del testo)', () => {
  it('solo un link: nessuna ricetta nel testo', () => {
    const i = interpretShare({ title: 'Tiramisù - Sito', text: 'https://sito.it/t', url: '' })
    expect(i).toMatchObject({ link: 'https://sito.it/t', title: 'Tiramisù - Sito', notes: '', parsed: null })
  })
  it('testo di ricetta senza link → riconosciuto', () => {
    const i = interpretShare({ title: '', text: 'Pancake\nIngredienti\n200 g farina\n2 uova\nPreparazione\nMescola e cuoci in padella.', url: '' })
    expect(i.parsed).not.toBeNull()
    expect(i.notes).toBe('')
    expect(parsedToDraft(i.parsed!, { link: i.link }).mainIngredients).toBe('farina, uova')
  })
  it('testo di ricetta con il link della pagina in fondo', () => {
    const i = interpretShare({ title: '', text: 'Pancake\nIngredienti\n200 g farina\n2 uova\nPreparazione\nMescola e cuoci.\nhttps://sito.it/pancake', url: '' })
    expect(i.link).toBe('https://sito.it/pancake')
    expect(i.parsed?.ingredients).toEqual(['200 g farina', '2 uova'])
  })
  it('testo normale senza link finisce nelle note', () => {
    expect(interpretShare({ title: 'Nonna', text: 'chiedere la ricetta alla zia', url: '' })).toMatchObject({ notes: 'chiedere la ricetta alla zia', parsed: null, link: '' })
  })
})
