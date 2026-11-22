import { describe, expect, it } from 'vitest'
import { originAllowed, safeEqual, validateTarget } from '../src/security'

const ok = (u: string) => validateTarget(u).ok
const reason = (u: string) => { const v = validateTarget(u); return v.ok ? 'ok' : v.reason }

describe('validateTarget', () => {
  it('accetta normali pagine web', () => {
    expect(ok('https://www.giallozafferano.it/ricetta/Tiramisu.html')).toBe(true)
    expect(ok('http://sito.it/a?b=1#c')).toBe(true)
    expect(ok('https://sito.it:443/x')).toBe(true)
    expect(ok('  https://sito.it/x  ')).toBe(true)
  })
  it('rifiuta quel che non è http/https o non è un indirizzo', () => {
    for (const u of ['ftp://sito.it/x', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x', 'non un indirizzo', '', 'gopher://sito.it'])
      expect(reason(u)).toBe('bad_url')
    expect(reason(undefined as unknown as string)).toBe('bad_url')
    expect(reason('https://sito.it/' + 'a'.repeat(3000))).toBe('bad_url')
  })
  it('rifiuta localhost e nomi interni', () => {
    for (const u of ['http://localhost/', 'http://localhost:8787/', 'http://foo.localhost/', 'http://stampante.local/', 'https://metadata.google.internal/computeMetadata/v1/',
      'http://intranet/', 'http://router.lan/', 'http://metadata/', 'https://x.home.arpa/'])
      expect(ok(u), u).toBe(false)
  })
  it('rifiuta qualunque indirizzo IP, anche scritto in forme strane', () => {
    for (const u of [
      'http://127.0.0.1/', 'http://127.1/', 'http://0x7f.0.0.1/', 'http://2130706433/', 'http://017700000001/', 'http://0/', 'http://0.0.0.0/',
      'http://10.0.0.5/', 'http://172.16.0.1/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/', 'http://100.64.0.1/',
      'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[fe80::1]/', 'http://[fd00::1]/', 'http://[2001:db8::1]/', 'http://8.8.8.8/',
      'http://1.2.3.4.5/', 'http://example.123/',
    ]) expect(ok(u), u).toBe(false)
  })
  it('rifiuta credenziali, porte strane e servizi che mappano IP in nomi', () => {
    expect(reason('http://utente:pw@sito.it/')).toBe('blocked')
    for (const u of ['http://sito.it:8080/', 'http://sito.it:22/', 'https://sito.it:6379/']) expect(reason(u)).toBe('blocked')
    for (const u of ['http://127.0.0.1.nip.io/', 'http://a.b.sslip.io/', 'http://x.localtest.me/', 'http://localtest.me/']) expect(ok(u), u).toBe(false)
  })
  it('un punto finale non aggira i controlli', () => {
    expect(ok('http://localhost./')).toBe(false)
    expect(ok('http://127.0.0.1./')).toBe(false)
  })
})

describe('originAllowed', () => {
  const list = 'https://bubbismo.github.io, http://localhost:4173/'
  it('solo le origini elencate; mai "*"', () => {
    expect(originAllowed('https://bubbismo.github.io', list)).toBe(true)
    expect(originAllowed('http://localhost:4173', list)).toBe(true)
    expect(originAllowed('https://altro.github.io', list)).toBe(false)
    expect(originAllowed('https://bubbismo.github.io.evil.com', list)).toBe(false)
    expect(originAllowed(null, list)).toBe(false)
    expect(originAllowed('https://x.it', '*')).toBe(false)
    expect(originAllowed('https://x.it', undefined)).toBe(false)
  })
})

describe('safeEqual', () => {
  it('confronta stringhe', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})
