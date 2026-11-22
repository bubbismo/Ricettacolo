import { describe, expect, it } from 'vitest'
import { interpretShare } from './share'

describe('interpretShare', () => {
  it('Chrome: indirizzo nel testo, titolo della pagina', () => {
    expect(interpretShare({ title: 'Tiramisù classico - Sito', text: 'https://sito.it/tiramisu', url: '' }))
      .toMatchObject({ link: 'https://sito.it/tiramisu', title: 'Tiramisù classico - Sito', notes: '', parsed: null })
  })
  it('altre app: indirizzo in url, testo con frase intorno', () => {
    expect(interpretShare({ title: '', text: 'Guarda che buona!', url: 'https://sito.it/r?x=1' }).link).toBe('https://sito.it/r?x=1')
    expect(interpretShare({ title: '', text: 'Guarda https://sito.it/r, buona!', url: '' }).link).toBe('https://sito.it/r')
  })
  it('titolo che è solo l\'indirizzo: non si usa', () => {
    expect(interpretShare({ title: 'https://sito.it/r', text: '', url: 'https://sito.it/r' }).title).toBe('')
  })
  it('testo senza link finisce nelle note', () => {
    expect(interpretShare({ title: 'Nonna', text: '200 g farina, 3 uova', url: '' })).toMatchObject({ link: '', title: 'Nonna', notes: '200 g farina, 3 uova', parsed: null })
  })
})
