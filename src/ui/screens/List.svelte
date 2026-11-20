<script lang="ts">
  import { store } from '../../app/store.svelte'
  import { go } from '../../app/router.svelte'
  import Photo from '../components/Photo.svelte'
  import Stars from '../components/Stars.svelte'
  import Steam from '../components/Steam.svelte'
  import type { Filters } from '../../core/search'
  import { exportPackage, exportPdf } from '../../app/exporting'

  let showFilters = $state(false)
  let selecting = $state(false)
  let selected = $state<string[]>([])
  let busy = $state(false)
  let status = $state('')
  const f = store.filters

  const sorts: { v: Filters['sort']; t: string }[] = [
    { v: 'title', t: 'Titolo' }, { v: 'date', t: 'Data' }, { v: 'rating', t: 'Voto' }, { v: 'cooked', t: 'Cucinata di recente' },
  ]
  const activeCount = $derived(
    (f.category ? 1 : 0) + (f.minRating ? 1 : 0) + (f.favoritesOnly ? 1 : 0) + (f.cooked !== 'all' ? 1 : 0),
  )
  const list = $derived(store.visible)

  const chosen = $derived(store.recipes.filter((r) => selected.includes(r.id)))
  const toggle = (id: string) => { selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] }
  function endSelect() { selecting = false; selected = [] }
  const selectAllVisible = () => { selected = list.map((r) => r.id) }

  async function doPdf() {
    busy = true
    try {
      const res = await exportPdf(chosen, (t) => (status = t))
      status = res === 'downloaded' ? 'PDF salvato nei download' : res === 'shared' ? 'PDF condiviso' : ''
    } catch (e) { status = `Errore: ${e instanceof Error ? e.message : e}` } finally { busy = false }
  }
  async function doPackage() {
    busy = true
    try {
      await exportPackage(chosen)
      status = 'Salvato nei download. Per importarlo in un\'altra app usa «Importa» nelle Impostazioni.'
    } catch (e) { status = `Errore: ${e instanceof Error ? e.message : e}` } finally { busy = false }
  }

  function reset() {
    f.category = null; f.minRating = 0; f.favoritesOnly = false; f.cooked = 'all'
  }
</script>

<div class="page">
  <div class="topbar">
    <h1>Ricettacolo</h1>
    {#if store.recipes.length}
      <button class="btn" style="min-height:44px;padding:6px 14px" onclick={() => (selecting ? endSelect() : (selecting = true))}>
        {selecting ? 'Fine' : '☑ Seleziona'}
      </button>
    {/if}
  </div>

  {#if store.backupDue}
    <div class="banner">
      {store.lastBackup ? 'Il tuo ultimo backup è vecchio.' : 'Non hai ancora fatto un backup.'}
      Salva una copia delle ricette per non rischiare di perderle.
      <div class="row">
        <a class="btn" href="#/impostazioni">Fai il backup</a>
        <button class="btn" onclick={() => (store.reminderDismissed = true)}>Più tardi</button>
      </div>
    </div>
  {/if}

  <div class="row" style="flex-wrap:nowrap;margin-bottom:10px">
    <input class="input" type="search" placeholder="Cerca titolo, ingredienti, note…" bind:value={f.query} enterkeyhint="search" />
    <button class="iconbtn" aria-label="Filtri e ordinamento" aria-expanded={showFilters} onclick={() => (showFilters = !showFilters)}>
      ⚙{#if activeCount}<sup>{activeCount}</sup>{/if}
    </button>
  </div>

  {#if store.categories.length}
    <div class="chips scroll" style="margin-bottom:8px">
      <button class="chip" aria-pressed={!f.category} onclick={() => (f.category = null)}>Tutte</button>
      {#each store.categories as c (c)}
        <button class="chip" aria-pressed={f.category === c} onclick={() => (f.category = f.category === c ? null : c)}>{c}</button>
      {/each}
    </div>
  {/if}

  {#if showFilters}
    <div class="card">
      <span class="lbl">Voto minimo</span>
      <div class="chips" style="margin-bottom:12px">
        {#each [0, 3, 4, 5] as n (n)}
          <button class="chip" aria-pressed={f.minRating === n} onclick={() => (f.minRating = n)}>{n === 0 ? 'Qualsiasi' : `${n}★ e più`}</button>
        {/each}
      </div>
      <span class="lbl">Mostra</span>
      <div class="chips" style="margin-bottom:12px">
        <button class="chip" aria-pressed={f.favoritesOnly} onclick={() => (f.favoritesOnly = !f.favoritesOnly)}>♥ Preferite</button>
        <button class="chip" aria-pressed={f.cooked === 'tried'} onclick={() => (f.cooked = f.cooked === 'tried' ? 'all' : 'tried')}>Provate</button>
        <button class="chip" aria-pressed={f.cooked === 'never'} onclick={() => (f.cooked = f.cooked === 'never' ? 'all' : 'never')}>Mai provate</button>
      </div>
      <label class="lbl" for="sort">Ordina per</label>
      <select id="sort" class="input" bind:value={f.sort}>
        {#each sorts as s (s.v)}<option value={s.v}>{s.t}</option>{/each}
      </select>
      {#if activeCount}<button class="btn block" style="margin-top:12px" onclick={reset}>Azzera filtri</button>{/if}
    </div>
  {/if}

  {#if !store.loaded}
    <p class="hint">Caricamento…</p>
  {:else if store.recipes.length === 0}
    <div class="card" style="text-align:center">
      <div class="empty-bowl"><Steam size={84} tone="tan" count={3} /><span>🍲</span></div>
      <h2>Il ricettario è vuoto</h2>
      <p class="hint">Tocca il pulsante + per aggiungere la prima ricetta: basta una foto della pagina.</p>
    </div>
  {:else if list.length === 0}
    <p class="hint">Nessuna ricetta corrisponde alla ricerca.</p>
  {:else}
    <p class="hint" style="margin:0 0 8px">{list.length} {list.length === 1 ? 'ricetta' : 'ricette'}</p>
    <ul class="grid">
      {#each list as r, i (r.id)}
        <li style={`--i:${Math.min(i, 10)}`}>
          <button class="rc" class:sel={selected.includes(r.id)} onclick={() => (selecting ? toggle(r.id) : go(`/r/${r.id}`))}>
            <div class="thumb">
              {#if r.photoIds[0]}<Photo id={r.photoIds[0]} alt="" />{:else}<span class="noimg">🍽</span>{/if}
              {#if selecting}<span class="check" aria-hidden="true">{selected.includes(r.id) ? '✓' : ''}</span>{/if}
              {#if r.favorite}<span class="heart" aria-label="Preferita">♥</span>{/if}
              {#if r.photoIds.length > 1}<span class="pages">{r.photoIds.length} pag.</span>{/if}
            </div>
            <div class="meta">
              <strong>{r.title || 'Senza titolo'}</strong>
              {#if r.source}<small>{r.source}</small>{/if}
              <Stars value={r.rating} />
            </div>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if selecting}
  <div class="selbar">
    <div>
      <p><b>{selected.length}</b> {selected.length === 1 ? 'selezionata' : 'selezionate'}
        <button class="lnk" onclick={selectAllVisible}>Tutte quelle in elenco</button>
        {#if selected.length}<button class="lnk" onclick={() => (selected = [])}>Nessuna</button>{/if}</p>
      {#if status}<p class="st" role="status">{status}</p>{/if}
      <div class="row">
        <button class="btn primary" disabled={busy || !selected.length} onclick={doPdf}>{busy ? 'Attendi…' : '📄 PDF'}</button>
        <button class="btn" disabled={busy || !selected.length} onclick={doPackage}>📦 Per un'altra app</button>
      </div>
    </div>
  </div>
{:else}
  <a class="fab" href="#/nuova" aria-label="Aggiungi ricetta">+</a>
{/if}

<style>
  sup { font-size: 12px; color: var(--accent); font-weight: 700; }
  .grid li { animation: rise .4s ease-out both; animation-delay: calc(var(--i, 0) * 40ms); }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .rc { width: 100%; text-align: left; padding: 0; border: 1.5px solid var(--line); border-radius: 16px; background: var(--card); overflow: hidden; display: block; }
  .thumb { position: relative; aspect-ratio: 4 / 3; background: var(--line); overflow: hidden; display: grid; place-items: center; }
  .noimg { font-size: 40px; opacity: .6; }
  .rc.sel { outline: 3px solid var(--accent); }
  .check { position: absolute; top: 6px; left: 6px; width: 28px; height: 28px; border-radius: 50%; background: var(--card); border: 2px solid var(--accent); color: var(--accent); display: grid; place-items: center; font-weight: 800; }
  .rc.sel .check { background: var(--accent); color: var(--accent-ink); }
  .selbar { position: fixed; left: 0; right: 0; bottom: calc(var(--tab-h) + env(safe-area-inset-bottom)); z-index: 25; background: var(--bg); border-top: 1.5px solid var(--line); padding: 10px 16px; }
  .selbar > div { max-width: 600px; margin: 0 auto; }
  .selbar p { margin: 0 0 8px; font-size: 16px; }
  .selbar .st { color: var(--muted); font-size: 15px; }
  .lnk { background: none; border: 0; color: var(--accent); font-size: 15px; font-weight: 600; padding: 4px 8px; text-decoration: underline; }
  .heart { position: absolute; top: 6px; right: 8px; color: var(--accent); font-size: 22px; text-shadow: 0 0 4px #fff; }
  .pages { position: absolute; bottom: 6px; left: 6px; background: rgba(0, 0, 0, .6); color: #fff; font-size: 12px; padding: 2px 8px; border-radius: 99px; }
  .meta { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 2px; }
  .meta strong { font-size: 17px; line-height: 1.2; overflow-wrap: anywhere; }
  .meta small { color: var(--muted); font-size: 14px; }
</style>
