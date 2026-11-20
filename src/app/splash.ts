const KEY = 'ricettacolo.splash'

/** La schermata iniziale si può disattivare dalle impostazioni; si legge subito, così non lampeggia. */
export function splashEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}
export function setSplashEnabled(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* senza archivio locale resta sempre attiva */ }
}
