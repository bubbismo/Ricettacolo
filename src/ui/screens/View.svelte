<script lang="ts">
  import { store } from '../../app/store.svelte'
  import { back, go } from '../../app/router.svelte'
  import { commitRecipe, deleteRecipe } from '../../adapters/storage/db'
  import { buildRicettario, backupFileName } from '../../adapters/backup/ricettario'
  import { reducePhoto } from '../../adapters/image/process'
  import { deliver } from '../../adapters/device/files'
  import { formatDate, toContent, todayISO, type Rating } from '../../core/recipe'
  import Photo from '../components/Photo.svelte'
  import Stars from '../components/Stars.svelte'

  let { id }: { id: string } = $props()
  const r = $derived(store.byId(id))
  let msg = $state('')
  let busy = $state(false)

  async function patch(change: Partial<ReturnType<typeof toContent>>) {
    if (!r) return
    await commitRecipe({ id: r.id, content: { ...toContent(r), ...change } })
    await store.load()
  }
  const cookedToday = async () => { await patch({ lastCookedAt: todayISO() }); toast('Segnata come cucinata oggi 👩‍🍳') }
  const setRating = (v: Rating | null) => patch({ rating: v })

  function toast(t: string) { msg = t; setTimeout(() => { if (msg === t) msg = '' }, 2500) }

  async function remove() {
    if (!r || !confirm(`Eliminare «${r.title || 'Senza titolo'}»? Non si può annullare.`)) return
    await deleteRecipe(r.id)
    await store.load()
    back()
  }

  async function exportOne() {
    if (!r) return
    busy = true
    try {
      const blob = await buildRicettario({ ids: [r.id], photoQuality: 'piena', deps: { reduce: reducePhoto } })
      const res = await deliver(blob, backupFileName('una', r.title), { preferShare: true })
      if (res !== 'cancelled') toast(res === 'shared' ? 'Ricetta condivisa' : 'File salvato nei download')
    } catch (e) {
      toast(`Errore: ${e instanceof Error ? e.message : e}`)
    } finally { busy = false }
  }
</script>

<div class="page">
  <div class="topbar">
    <button class="iconbtn" aria-label="Indietro" onclick={() => back('/')}>←</button>
    <h1>{r?.title || 'Ricetta'}</h1>
    {#if r}
      <button class="iconbtn" aria-label={r.favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
        style={r.favorite ? 'color:var(--accent)' : ''} onclick={() => patch({ favorite: !r.favorite })}>{r.favorite ? '♥' : '♡'}</button>
    {/if}
  </div>

  {#if !r}
    <p class="hint">{store.loaded ? 'Ricetta non trovata.' : 'Caricamento…'}</p>
  {:else}
    <div class="pages">
      {#each r.photoIds as pid, i (pid)}
        <figure>
          <Photo id={pid} full alt={`${r.title}, pagina ${i + 1}`} cls="page-img" />
          {#if r.photoIds.length > 1}<figcaption>Pagina {i + 1} di {r.photoIds.length}</figcaption>{/if}
        </figure>
      {/each}
      {#if r.photoIds.length === 0}<div class="card hint">Nessuna foto.</div>{/if}
    </div>

    <div class="card">
      <div class="line"><Stars value={r.rating} onchange={setRating} /></div>
      {#if r.source}<p class="kv"><b>Da</b> {r.source}</p>{/if}
      <p class="kv"><b>Data</b> {formatDate(r.date)}</p>
      {#if r.categories.length}
        <div class="chips" style="margin:6px 0">{#each r.categories as c (c)}<span class="chip" aria-pressed="true">{c}</span>{/each}</div>
      {/if}
      {#if r.mainIngredients}<p class="kv"><b>Ingredienti</b> {r.mainIngredients}</p>{/if}
      {#if r.notes}<p class="kv notes"><b>Note</b> {r.notes}</p>{/if}
      <p class="kv"><b>Ultima volta cucinata</b> {r.lastCookedAt ? formatDate(r.lastCookedAt) : 'mai'}</p>
    </div>

    <button class="btn primary block" onclick={cookedToday}>👩‍🍳 L'ho cucinata oggi</button>
    <div class="row" style="margin-top:12px">
      <button class="btn" onclick={() => go(`/e/${r.id}`)}>✏️ Modifica</button>
      <button class="btn" disabled={busy} onclick={exportOne}>📤 Condividi</button>
    </div>
    <button class="btn danger block" style="margin-top:12px" onclick={remove}>Elimina ricetta</button>
  {/if}
</div>

{#if msg}<div class="toast" role="status">{msg}</div>{/if}

<style>
  figure { margin: 0 0 12px; }
  figcaption { text-align: center; color: var(--muted); font-size: 14px; margin-top: 4px; }
  :global(.page-img) { height: auto !important; object-fit: contain !important; border-radius: 12px; background: var(--card); border: 1.5px solid var(--line); }
  .kv { margin: 6px 0; }
  .kv b { color: var(--muted); font-size: 15px; display: block; }
  .notes { white-space: pre-wrap; }
  .line { margin: -6px 0 4px -6px; }
</style>
