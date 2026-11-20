export type Route =
  | { name: 'list' }
  | { name: 'view'; id: string }
  | { name: 'edit'; id: string | null }
  | { name: 'settings' }
  | { name: 'inbox' }
  | { name: 'inboxEdit'; itemId: string }
  | { name: 'cook'; id: string }
  | { name: 'today' }

export function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/')
  if (p[0] === 'r' && p[1]) return { name: 'view', id: p[1] }
  if (p[0] === 'e' && p[1]) return { name: 'edit', id: p[1] }
  if (p[0] === 'nuova') return { name: 'edit', id: null }
  if (p[0] === 'sistema' && p[1]) return { name: 'inboxEdit', itemId: p[1] }
  if (p[0] === 'sistema') return { name: 'inbox' }
  if (p[0] === 'cucina' && p[1]) return { name: 'cook', id: p[1] }
  if (p[0] === 'oggi') return { name: 'today' }
  if (p[0] === 'impostazioni') return { name: 'settings' }
  return { name: 'list' }
}

/** Profondità della schermata: serve a scegliere da che parte "entra" la nuova pagina. */
const depth = (r: Route): number => (r.name === 'view' ? 1 : r.name === 'edit' || r.name === 'inboxEdit' || r.name === 'cook' ? 2 : 0)

class Router {
  route = $state<Route>(parse(location.hash))
  constructor() {
    document.documentElement.dataset.nav = 'tab'
    addEventListener('hashchange', () => {
      const next = parse(location.hash)
      const d = depth(next) - depth(this.route)
      // avanti = entra da destra, indietro = da sinistra, tra schede = sale dolcemente
      document.documentElement.dataset.nav = d > 0 ? 'forward' : d < 0 ? 'back' : 'tab'
      this.route = next
    })
  }
}

export const router = new Router()

export const go = (path: string) => { location.hash = path }
export const replace = (path: string) => { location.replace(`${location.pathname}${location.search}#${path}`) }
export const back = (fallback = '/') => {
  if (history.length > 1) history.back()
  else replace(fallback)
}
