import { describe, expect, it } from 'vitest'
import { splitForSpeech } from './speech'

describe('splitForSpeech', () => {
  it('rispetta la lunghezza massima e non perde testo', () => {
    const text = 'Prima frase. ' + 'parola '.repeat(80) + '. Ultima frase!'
    const chunks = splitForSpeech(text, 100)
    expect(chunks.every((c) => c.length <= 100)).toBe(true)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toContain('Ultima frase!')
    expect(chunks.join(' ').split('parola').length - 1).toBe(80)
  })
  it('vuoto → nessun blocco; a capo diventano pause', () => {
    expect(splitForSpeech('  ')).toEqual([])
    expect(splitForSpeech('Uno\n\nDue')).toEqual(['Uno. Due'])
  })
})
