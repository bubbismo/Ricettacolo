import { normalizeServiceUrl } from '../core/importService'

const URL_KEY = 'ricettacolo.importUrl'
const KEY_KEY = 'ricettacolo.importKey'

const read = (k: string): string => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }
const write = (k: string, v: string) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k) } catch { /* senza archivio locale l'impostazione dura fino alla chiusura */ } }

/**
 * Servizio di importazione (facoltativo). Impostazione del singolo telefono: non entra nei backup.
 * Senza indirizzo la funzione non esiste e l'app si comporta come sempre.
 */
class ImportConfig {
  url = $state(normalizeServiceUrl(read(URL_KEY)))
  key = $state(read(KEY_KEY))
  get enabled(): boolean { return this.url !== '' }

  save(url: string, key: string): boolean {
    const u = normalizeServiceUrl(url)
    if (url.trim() && !u) return false
    this.url = u
    this.key = key.trim()
    write(URL_KEY, this.url)
    write(KEY_KEY, this.key)
    return true
  }
  clear() { this.save('', '') }
}

export const importConfig = new ImportConfig()
