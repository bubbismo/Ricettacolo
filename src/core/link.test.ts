import { describe, expect, it } from 'vitest'
import { cleanLink, extractUrl, hostLabel, linkError, linkKey } from './link'

describe('link', () => {
  it('estrae l\'indirizzo da testo con altro intorno', () => {
    expect(extractUrl('Guarda questa ricetta https://www.sito.it/tiramisu, è ottima!')).toBe('https://www.sito.it/tiramisu')
    expect(extractUrl('(vedi https://sito.it/a?b=1&c=2).')).toBe('https://sito.it/a?b=1&c=2')
    expect(extractUrl('https://it.wikipedia.org/wiki/Pasta_(alimento)')).toBe('https://it.wikipedia.org/wiki/Pasta_(alimento)')
    expect(extractUrl('«http://sito.it/x»')).toBe('http://sito.it/x')
  })
  it('rifiuta quel che non è http/https', () => {
    expect(extractUrl('javascript:alert(1)')).toBeNull()
    expect(extractUrl('ftp://sito.it/file')).toBeNull()
    expect(extractUrl('www.sito.it/ricetta')).toBeNull()
    expect(extractUrl('niente qui')).toBeNull()
    expect(cleanLink('javascript:alert(1)')).toBe('')
    expect(cleanLink(42)).toBe('')
  })
  it('messaggi di errore', () => {
    expect(linkError('')).toBe('')
    expect(linkError('  ')).toBe('')
    expect(linkError('https://sito.it')).toBe('')
    expect(linkError('sito.it')).not.toBe('')
  })
  it('etichetta e confronto tra link equivalenti', () => {
    expect(hostLabel('https://www.sito.it/x')).toBe('sito.it')
    expect(linkKey('https://www.sito.it/ricetta/?utm_source=wa#top')).toBe(linkKey('http://sito.it/ricetta'))
    expect(linkKey('https://sito.it/a?id=1')).not.toBe(linkKey('https://sito.it/a?id=2'))
  })
})
