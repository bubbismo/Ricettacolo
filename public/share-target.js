// Riceve i contenuti del tasto "Condividi" di Android (Web Share Target).
// Non c'è nessun server: la richiesta arriva qui, nel service worker, che mette da parte le immagini
// e rimanda l'app con i testi nell'indirizzo. Importato dal service worker principale.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return
  event.respondWith((async () => {
    const scope = self.registration.scope
    try {
      const form = await event.request.formData()
      const cache = await caches.open('ricettacolo-share')
      for (const k of await cache.keys()) await cache.delete(k)
      const files = form.getAll('media').filter((f) => f instanceof File && f.type.startsWith('image/'))
      let i = 0
      for (const f of files) {
        await cache.put(new Request(`${scope}shared-file-${i++}`), new Response(f, { headers: { 'Content-Type': f.type } }))
      }
      const q = new URLSearchParams({ share: '1', files: String(files.length) })
      for (const k of ['title', 'text', 'url']) {
        const v = form.get(k)
        if (typeof v === 'string' && v) q.set(k, v.slice(0, 2000))
      }
      return Response.redirect(`${scope}?${q}`, 303)
    } catch {
      return Response.redirect(scope, 303)
    }
  })())
})
