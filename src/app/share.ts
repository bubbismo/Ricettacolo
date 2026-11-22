import { putInboxItems } from '../adapters/storage/db'
import { processFile } from '../adapters/image/process'
import { interpretShare, type SharedContent } from '../core/share'
import { newId } from '../core/recipe'
import { replace } from './router.svelte'
import { store } from './store.svelte'

const SCOPE = () => new URL(import.meta.env.BASE_URL, location.origin).href

async function importSharedImages(n: number): Promise<number> {
  let done = 0
  if (!('caches' in self)) return 0
  const cache = await caches.open('ricettacolo-share')
  const base = new Date().getTime()
  for (let i = 0; i < n; i++) {
    const key = new Request(`${SCOPE()}shared-file-${i}`)
    try {
      const res = await cache.match(key)
      if (!res) continue
      const np = await processFile(await res.blob())
      await putInboxItems([{ id: newId(), photoId: np.photo.id, addedAt: new Date(base + i).toISOString() }], [np])
      await cache.delete(key) // si toglie solo dopo averla salvata al sicuro
      done++
    } catch { /* una foto illeggibile non ferma le altre */ }
  }
  return done
}

/** Se l'app è stata aperta dal tasto Condividi, mette i dati al loro posto: link → nuova ricetta, immagini → "Da sistemare". */
export async function handleShare(): Promise<void> {
  const q = new URLSearchParams(location.search)
  if (q.get('share') !== '1') return
  // pulisce l'indirizzo: un ricaricamento non deve ripetere la condivisione
  history.replaceState(null, '', `${location.pathname}${location.hash}`)

  const shared: SharedContent = { title: q.get('title') ?? '', text: q.get('text') ?? '', url: q.get('url') ?? '', files: Number(q.get('files') ?? 0) || 0 }
  const added = shared.files > 0 ? await importSharedImages(shared.files) : 0
  if (added) await store.load()

  const { link, title, notes } = interpretShare(shared)
  if (link || notes) {
    store.shareDraft = { link, title, notes }
    replace('/nuova')
  } else if (added) {
    replace('/sistema')
  }
}
