import { splitForSpeech } from '../../core/speech'

export type ReaderState = 'idle' | 'playing' | 'paused'

export const speechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

function italianVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices()
  return voices.find((v) => v.lang.toLowerCase().replace('_', '-') === 'it-it') ?? voices.find((v) => v.lang.toLowerCase().startsWith('it'))
}

/**
 * Lettura a voce con la voce italiana di sistema. La "pausa" è fatta a mano (si ferma e poi si riparte
 * dall'inizio della frase corrente), perché pause/resume nativi non funzionano su tutti i telefoni.
 */
export class Reader {
  private chunks: string[] = []
  private i = 0
  private gen = 0
  state: ReaderState = 'idle'

  constructor(private onState: (s: ReaderState) => void, private onFail: () => void = () => {}) {}

  private set(s: ReaderState) { this.state = s; this.onState(s) }

  play(text: string) {
    if (this.state === 'paused') return this.resume()
    this.chunks = splitForSpeech(text)
    this.i = 0
    if (!this.chunks.length) return
    this.gen++
    speechSynthesis.cancel()
    this.set('playing')
    const g = this.gen
    setTimeout(() => this.next(g), 60) // dopo cancel() alcuni browser perdono un speak() immediato
  }

  private next(g: number) {
    if (g !== this.gen) return
    if (this.i >= this.chunks.length) { this.i = 0; this.set('idle'); return }
    const u = new SpeechSynthesisUtterance(this.chunks[this.i])
    u.lang = 'it-IT'
    const v = italianVoice()
    if (v) u.voice = v
    u.onend = () => { if (g === this.gen) { this.i++; this.next(g) } }
    u.onerror = (e) => {
      if (g !== this.gen || e.error === 'canceled' || e.error === 'interrupted') return
      this.gen++
      this.i = 0
      this.set('idle')
      this.onFail() // di solito: sul dispositivo non c'è una voce italiana
    }
    speechSynthesis.speak(u)
  }

  pause() {
    if (this.state !== 'playing') return
    this.gen++
    speechSynthesis.cancel()
    this.set('paused')
  }

  resume() {
    if (this.state !== 'paused') return
    this.gen++
    this.set('playing')
    const g = this.gen
    setTimeout(() => this.next(g), 60)
  }

  stop() {
    this.gen++
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()
    this.i = 0
    this.set('idle')
  }
}
