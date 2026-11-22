<script lang="ts">
  import { onDestroy } from 'svelte'
  import { store } from '../../app/store.svelte'
  import { back, replace } from '../../app/router.svelte'
  import { addCategories, commitRecipe, getPhoto, type NewPhoto } from '../../adapters/storage/db'
  import { buildPhoto, processFile } from '../../adapters/image/process'
  import { importPdf, isPdf } from '../../adapters/pdf/importPdf'
  import { recognizer } from '../../adapters/recognizer'
  import { emptyContent, toContent, type Rating, type RecipeContent } from '../../core/recipe'
  import { extractUrl, linkError, linkKey } from '../../core/link'
  import Photo from '../components/Photo.svelte'
  import Stars from '../components/Stars.svelte'
  import PhotoEditor from '../components/PhotoEditor.svelte'

  let { id, inboxId = null }: { id: string | null; inboxId?: string | null } = $props()

  interface Draft { id: string; fresh?: NewPhoto; url?: string; inboxId?: string }

  let ready = $state(false)
  let content = $state<RecipeContent>(emptyContent())
  let photos = $state<Draft[]>([])
  let initial = ''
  let busy = $state(0)
  let saving = $state(false)
  let error = $state('')
  let editing = $state<{ index: number; blob: Blob } | null>(null)
  let newCat = $state('')
  let linkMsg = $state('')
  let pdfStatus = $state('')
  let ocrBusy = $state(false)
  let ocrFraction = $state(0)
  let ocrLabel = $state('')
  let ocrMsg = $state('')
  let ocrAbort: AbortController | null = null

  const snapshot = () => JSON.stringify([{ ...content, photoIds: photos.map((p) => p.id) }])
  const dirty = $derived(ready && snapshot() !== initial)

  $effect(() => {
    if (ready || !store.loaded) return
    const r = id ? store.byId(id) : undefined
    if (id && !r) { error = 'Ricetta non trovata.'; return }
    const item = inboxId ? store.inbox.find((i) => i.id === inboxId) : undefined
    if (inboxId && !item) { error = 'Questa foto non è più nella cassetta.'; return }
    content = r ? toContent(r) : emptyContent()
    // arrivo dal tasto Condividi: link (e titolo della pagina) già compilati
    const shared = !id && !inboxId ? store.shareDraft : null
    if (shared) {
      content.link = shared.link
      if (shared.title) content.title = shared.title
      if (shared.notes) content.notes = shared.notes
      store.shareDraft = null
    }
    photos = item ? [{ id: item.photoId, inboxId: item.id }] : content.photoIds.map((pid) => ({ id: pid }))
    initial = snapshot()
    ready = true
  })

  onDestroy(() => photos.forEach((p) => p.url && URL.revokeObjectURL(p.url)))

  const mkDraft = (f: NewPhoto): Draft => ({ id: f.photo.id, fresh: f, url: URL.createObjectURL(f.thumb.blob) })

  async function addFiles(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const files = [...(input.files ?? [])]
    input.value = ''
    error = ''
    for (const f of files) {
      busy++
      try {
        if (isPdf(f)) {
          const res = await importPdf(f, (d, t) => (pdfStatus = `Leggo il PDF… pagina ${d} di ${t}`))
          res.photos.forEach((np) => photos.push(mkDraft(np)))
          // PDF con testo vero: il testo si prende direttamente, senza OCR
          if (res.text) content.ocrText = content.ocrText ? `${content.ocrText}\n\n${res.text}` : res.text
        } else photos.push(mkDraft(await processFile(f)))
      } catch {
        error = isPdf(f) ? `Non riesco ad aprire il PDF «${f.name}».` : `Non riesco a leggere «${f.name}». Prova con una foto JPEG o PNG.`
      } finally { busy--; pdfStatus = '' }
    }
  }

  function move(i: number, d: number) {
    const j = i + d
    if (j < 0 || j >= photos.length) return
    ;[photos[i], photos[j]] = [photos[j], photos[i]]
  }
  function removePhoto(i: number) {
    const [p] = photos.splice(i, 1)
    if (p?.url) URL.revokeObjectURL(p.url)
  }

  async function openEditor(i: number) {
    const d = photos[i]
    const blob = d.fresh ? d.fresh.photo.blob : (await getPhoto(d.id))?.blob
    if (blob) editing = { index: i, blob }
  }
  async function editorDone(canvas: HTMLCanvasElement) {
    const i = editing!.index
    editing = null
    busy++
    try {
      const old = photos[i]
      photos[i] = { ...mkDraft(await buildPhoto(canvas)), inboxId: old.inboxId }
      if (old.url) URL.revokeObjectURL(old.url)
    } finally { busy-- }
  }

  /** Prossima foto della cassetta dopo quelle già nella bozza (poi, se finite, la prima disponibile). */
  const nextInbox = $derived.by(() => {
    if (!inboxId) return undefined
    const used = new Set(photos.map((p) => p.id))
    const list = store.inbox
    const last = Math.max(-1, ...list.map((it, i) => (used.has(it.photoId) ? i : -1)))
    return list.slice(last + 1).find((it) => !used.has(it.photoId)) ?? list.find((it) => !used.has(it.photoId))
  })
  const inboxLeft = $derived(store.inbox.filter((it) => !photos.some((p) => p.id === it.photoId)).length)
  const addNext = () => { if (nextInbox) photos.push({ id: nextInbox.photoId, inboxId: nextInbox.id }) }

  async function runOcr() {
    if (content.ocrText && !confirm('Sostituire il testo già presente con quello letto dalle foto?')) return
    ocrBusy = true; ocrMsg = ''; ocrFraction = 0; ocrLabel = 'Preparo…'
    ocrAbort = new AbortController()
    try {
      const blobs: Blob[] = []
      for (const p of photos) {
        const b = p.fresh ? p.fresh.photo.blob : (await getPhoto(p.id))?.blob
        if (b) blobs.push(b)
      }
      const res = await recognizer.recognize(blobs, {
        signal: ocrAbort.signal,
        onProgress: (f, label) => { ocrFraction = f; ocrLabel = label },
      })
      content.ocrText = res.rawText || null
      const filled: string[] = []
      if (!content.title.trim() && res.title) { content.title = res.title; filled.push('il titolo') }
      if (!content.mainIngredients.trim() && res.ingredients) { content.mainIngredients = res.ingredients; filled.push('gli ingredienti') }
      ocrMsg = !res.rawText
        ? 'Non ho trovato testo leggibile in queste foto.'
        : `Testo letto${filled.length ? `; ho compilato ${filled.join(' e ')}` : ''}. Controlla e correggi gli errori.`
    } catch (e) {
      ocrMsg = e instanceof DOMException && e.name === 'AbortError'
        ? 'Lettura annullata.'
        : 'Non riesco a leggere il testo. La prima volta serve la connessione per scaricare il lettore italiano; poi funziona anche senza rete.'
    } finally {
      ocrBusy = false; ocrAbort = null
    }
  }

  /** Dal testo incollato tiene solo l'indirizzo; se non ce n'è uno valido lo segnala. */
  function normalizeLink() {
    const v = content.link.trim()
    if (!v) { content.link = ''; linkMsg = ''; return }
    const u = extractUrl(v)
    if (u) { content.link = u; linkMsg = '' } else linkMsg = linkError(v)
  }
  async function pasteLink() {
    linkMsg = ''
    try {
      const text = await navigator.clipboard.readText()
      const u = extractUrl(text)
      if (u) content.link = u
      else linkMsg = 'Negli appunti non c\'è un link che inizia con http o https.'
    } catch {
      linkMsg = 'Non riesco a leggere gli appunti: incolla il link a mano nel campo.'
    }
  }
  /** Se lo stesso link è già in archivio, avviso (senza impedire nulla). */
  const duplicate = $derived.by(() => {
    const u = extractUrl(content.link)
    if (!u) return undefined
    const k = linkKey(u)
    return store.recipes.find((r) => r.id !== id && r.link && linkKey(r.link) === k)
  })

  const toggleCat = (c: string) => {
    content.categories = content.categories.includes(c) ? content.categories.filter((x) => x !== c) : [...content.categories, c]
  }
  async function createCat() {
    const n = newCat.trim()
    if (!n) return
    await addCategories([n])
    await store.load()
    const exact = store.categories.find((c) => c.toLowerCase() === n.toLowerCase()) ?? n
    if (!content.categories.includes(exact)) content.categories = [...content.categories, exact]
    newCat = ''
  }

  async function save() {
    error = ''
    if (!content.title.trim()) { error = 'Dai un titolo alla ricetta.'; return }
    normalizeLink()
    if (linkMsg && content.link.trim()) { error = linkMsg; return }
    saving = true
    try {
      const saved = await commitRecipe({
        id: id ?? undefined,
        // $state.snapshot: gli oggetti reattivi di Svelte non si possono clonare dentro IndexedDB
        content: { ...$state.snapshot(content), photoIds: photos.map((p) => p.id) },
        newPhotos: photos.flatMap((p) => (p.fresh ? [$state.snapshot(p.fresh) as NewPhoto] : [])),
        // le foto della cassetta usate in questa ricetta ne escono; quelle tolte dalla bozza restano in cassetta
        consumeInbox: photos.flatMap((p) => (p.inboxId ? [p.inboxId] : [])),
      })
      await store.load()
      initial = snapshot()
      if (inboxId) replace('/sistema')
      else if (id) back(`/r/${saved.id}`)
      else replace(`/r/${saved.id}`)
    } catch (e) {
      error = `Salvataggio non riuscito: ${e instanceof Error ? e.message : e}`
    } finally { saving = false }
  }

  function cancel() {
    if (dirty && !confirm('Uscire senza salvare le modifiche?')) return
    back('/')
  }
</script>

<div class="page">
  <div class="topbar">
    <button class="iconbtn" aria-label="Indietro" onclick={cancel}>←</button>
    <h1>{id ? 'Modifica ricetta' : inboxId ? 'Sistema la ricetta' : 'Nuova ricetta'}</h1>
  </div>

  {#if !ready}
    <p class="hint">{error || 'Caricamento…'}</p>
  {:else}
    <div class="field">
      <span class="lbl">Foto della ricetta</span>
      <div class="plist">
        {#each photos as p, i (p.id)}
          <div class="pitem">
            <div class="pth">
              {#if p.url}<img src={p.url} alt="" />{:else}<Photo id={p.id} alt="" />{/if}
            </div>
            <div class="pact">
              <span class="pn">Pagina {i + 1}</span>
              <div class="row" style="gap:6px">
                <button class="btn small" onclick={() => openEditor(i)}>✂️ Ritaglia / raddrizza</button>
              </div>
              <div class="row" style="gap:6px">
                <button class="btn small" aria-label="Sposta su" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
                <button class="btn small" aria-label="Sposta giù" disabled={i === photos.length - 1} onclick={() => move(i, 1)}>↓</button>
                <button class="btn small danger" aria-label="Rimuovi foto" onclick={() => removePhoto(i)}>🗑</button>
              </div>
            </div>
          </div>
        {/each}
        {#if busy}<p class="hint">{pdfStatus || 'Preparo la foto…'}</p>{/if}
      </div>
      <div class="row" style="margin-top:8px">
        <label class="btn" style="text-align:center">🖼 Dalla galleria
          <input type="file" accept="image/*,application/pdf" multiple hidden onchange={addFiles} />
        </label>
        <label class="btn" style="text-align:center">📷 Scatta
          <input type="file" accept="image/*" capture="environment" hidden onchange={addFiles} />
        </label>
      </div>
      {#if inboxId}
        <button class="btn block" style="margin-top:8px" disabled={!nextInbox} onclick={addNext}>
          ➕ Aggiungi anche la foto successiva{nextInbox ? ` (${inboxLeft} in cassetta)` : ' (nessuna altra)'}
        </button>
      {/if}
      <p class="hint">Più pagine? Aggiungile in ordine: puoi riordinarle con le frecce.</p>
    </div>

    <div class="field">
      <label for="title">Titolo</label>
      <input id="title" class="input" bind:value={content.title} autocomplete="off" enterkeyhint="next" />
    </div>
    <div class="field">
      <label for="source">Da chi / provenienza</label>
      <input id="source" class="input" placeholder="es. ricetta della nonna Maria" bind:value={content.source} autocomplete="off" />
    </div>
    <div class="field">
      <label for="link">Link (se viene dal web)</label>
      <div class="row" style="flex-wrap:nowrap">
        <input id="link" class="input" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false"
          placeholder="https://…" bind:value={content.link} onblur={normalizeLink} onpaste={() => setTimeout(normalizeLink)} />
        <button type="button" class="btn" style="flex:none" onclick={pasteLink}>📋 Incolla link</button>
      </div>
      {#if linkMsg}<p class="hint" style="color:var(--accent)" role="alert">{linkMsg}</p>{/if}
      {#if duplicate}
        <p class="banner" role="status">Hai già una ricetta con questo link: <a href={`#/r/${duplicate.id}`}><b>{duplicate.title || 'Senza titolo'}</b></a>.</p>
      {/if}
    </div>
    <div class="field">
      <label for="date">Data (quando l'hai ricevuta)</label>
      <input id="date" class="input" type="date" bind:value={content.date} />
    </div>

    <div class="field">
      <span class="lbl">Categorie</span>
      <div class="chips">
        {#each store.categories as c (c)}
          <button type="button" class="chip" aria-pressed={content.categories.includes(c)} onclick={() => toggleCat(c)}>{c}</button>
        {/each}
        {#each content.categories.filter((c) => !store.categories.includes(c)) as c (c)}
          <button type="button" class="chip" aria-pressed="true" onclick={() => toggleCat(c)}>{c}</button>
        {/each}
      </div>
      <div class="row" style="margin-top:8px;flex-wrap:nowrap">
        <input class="input" placeholder="Nuova categoria…" bind:value={newCat}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createCat() } }} />
        <button type="button" class="btn" style="flex:none" onclick={createCat}>Aggiungi</button>
      </div>
    </div>

    <div class="field">
      <span class="lbl">Voto</span>
      <Stars value={content.rating} onchange={(v: Rating | null) => (content.rating = v)} />
    </div>
    <div class="field">
      <button type="button" class="chip" aria-pressed={content.favorite} onclick={() => (content.favorite = !content.favorite)}>
        {content.favorite ? '♥ Preferita' : '♡ Preferita'}
      </button>
    </div>

    <div class="field">
      <label for="ing">Ingredienti principali</label>
      <input id="ing" class="input" placeholder="es. mascarpone, uova, caffè" bind:value={content.mainIngredients} autocomplete="off" />
      <p class="hint">Servono per la ricerca.</p>
    </div>
    <div class="field">
      <label for="notes">Note</label>
      <textarea id="notes" class="input" placeholder="es. meno zucchero, cuocere dieci minuti in più" bind:value={content.notes}></textarea>
    </div>
    <div class="field">
      <label for="ocr">Testo della ricetta (facoltativo)</label>
      <p class="hint" style="margin:0 0 8px">Per pagine <b>stampate</b>, screenshot e PDF. Non funziona con lo scritto a mano. Il testo serve per cercare e per la lettura a voce.</p>
      {#if ocrBusy}
        <div class="banner" role="status">{ocrLabel}
          <progress value={ocrFraction} max="1" style="width:100%"></progress>
          <button class="btn" onclick={() => ocrAbort?.abort()}>Annulla</button>
        </div>
      {:else}
        <button type="button" class="btn block" disabled={photos.length === 0 || busy > 0} onclick={runOcr}>🔍 Leggi il testo dalle foto</button>
      {/if}
      {#if ocrMsg}<p class="hint" role="status">{ocrMsg}</p>{/if}
      <textarea id="ocr" class="input" style="margin-top:8px;min-height:140px" placeholder="Qui compare il testo letto: puoi correggerlo o scriverlo tu"
        value={content.ocrText ?? ''} oninput={(e) => (content.ocrText = e.currentTarget.value || null)}></textarea>
    </div>

    <div class="field">
      <label for="cooked">Ultima volta cucinata</label>
      <div class="row" style="flex-wrap:nowrap">
        <input id="cooked" class="input" type="date" value={content.lastCookedAt ?? ''}
          onchange={(e) => (content.lastCookedAt = e.currentTarget.value || null)} />
        {#if content.lastCookedAt}<button type="button" class="btn" style="flex:none" onclick={() => (content.lastCookedAt = null)}>Cancella</button>{/if}
      </div>
    </div>

    {#if error}<p class="banner" role="alert">{error}</p>{/if}
  {/if}
</div>

{#if ready}
  <div class="savebar">
    <div>
      <button class="btn" onclick={cancel}>Annulla</button>
      <button class="btn primary" disabled={saving || busy > 0} onclick={save}>{saving ? 'Salvo…' : 'Salva'}</button>
    </div>
  </div>
{/if}

{#if editing}
  <PhotoEditor blob={editing.blob} onconfirm={editorDone} oncancel={() => (editing = null)} />
{/if}

<style>
  .plist { display: flex; flex-direction: column; gap: 10px; }
  .pitem { display: flex; gap: 12px; background: var(--card); border: 1.5px solid var(--line); border-radius: 14px; padding: 8px; }
  .pth { width: 96px; height: 120px; flex: none; border-radius: 8px; overflow: hidden; background: var(--line); }
  .pth img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pact { display: flex; flex-direction: column; gap: 8px; justify-content: center; flex: 1; min-width: 0; }
  .pn { font-weight: 700; }
  .btn.small { min-height: 44px; padding: 6px 10px; font-size: 15px; flex: 1; }
</style>
