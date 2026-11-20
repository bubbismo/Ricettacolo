export type Route =
  | { name: 'list' }
  | { name: 'view'; id: string }
  | { name: 'edit'; id: string | null }
  | { name: 'settings' }

export function parse(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/')
  if (p[0] === 'r' && p[1]) return { name: 'view', id: p[1] }
  if (p[0] === 'e' && p[1]) return { name: 'edit', id: p[1] }
  if (p[0] === 'nuova') return { name: 'edit', id: null }
  if (p[0] === 'impostazioni') return { name: 'settings' }
  return { name: 'list' }
}

class Router {
  route = $state<Route>(parse(location.hash))
  constructor() {
    addEventListener('hashchange', () => { this.route = parse(location.hash) })
  }
}

export const router = new Router()

export const go = (path: string) => { location.hash = path }
export const replace = (path: string) => { location.replace(`${location.pathname}${location.search}#${path}`) }
export const back = (fallback = '/') => {
  if (history.length > 1) history.back()
  else replace(fallback)
}
