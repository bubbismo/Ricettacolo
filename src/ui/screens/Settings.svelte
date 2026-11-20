<script lang="ts">
  import { onMount } from 'svelte'
  import { store } from '../../app/store.svelte'
  import { addCategories, renameCategory, reorderCategories } from '../../adapters/storage/db'
  import { BackupError, backupFileName, buildRicettario, importRicettario, type ImportResult, type PhotoQuality } from '../../adapters/backup/ricettario'
  import { makeThumb, reducePhoto } from '../../adapters/image/process'
  import { deliver } from '../../adapters/device/files'
  import { formatBytes, markBackupDone, storageUsage } from '../../adapters/device/storage'
  import { formatDate } from '../../core/recipe'

  let quality = $state<PhotoQuality>('piena')
  let busy = $state('')
  let message = $state('')
  let result = $state<ImportResult | null>(null)
  let usage = $state<{ used: number; quota: number } | null>(null)
  let newCat = $state('')

  onMount(async () => { usage = await storageUsage() })

  async function exportAll() {
    busy = 'export'; message = ''; result = null
    try {
      const blob = await buildRicettario({ photoQuality: quality, deps: { reduce: reducePhoto } })
      const res = await deliver(blob, backupFileName('tutto'), { preferShare: true })
      if (res !== 'cancelled') {
        await markBackupDone()
        await store.load()
        message = res === 'shared'
          ? `Backup pronto (${formatBytes(blob.size)}). Salvalo in un posto sicuro (File, Drive, e-mail a te stessa).`
          : `Backup scaricato (${formatBytes(blob.size)}). Controlla la cartella dei download.`
      }
    } catch (e) {
      message = `Backup non riuscito: ${e instanceof Error ? e.message : e}`
    } finally { busy = '' }
  }

  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    busy = 'import'; message = ''; result = null
    try {
      result = await importRicettario(file, { makeThumb })
      await store.load()
      usage = await storageUsage()
    } catch (err) {
      message = err instanceof BackupError ? err.message : `Importazione non riuscita: ${err instanceof Error ? err.message : err}`
    } finally { busy = '' }
  }

  async function moveCat(i: number, d: number) {
    const arr = [...store.categories]
    const j = i + d
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    await reorderCategories(arr)
    await store.load()
  }
  async function rename(c: string) {
    const n = prompt('Nuovo nome della categoria', c)?.trim()
    if (!n || n === c) return
    await renameCategory(c, n)
    await store.load()
  }
  async function removeCat(c: string) {
    const n = store.recipes.filter((r) => r.categories.includes(c)).length
    const txt = n ? `Eliminare la categoria «${c}»? Verrà tolta anche da ${n} ${n === 1 ? 'ricetta' : 'ricette'} (le ricette restano).` : `Eliminare la categoria «${c}»?`
    if (!confirm(txt)) return
    await renameCategory(c, null)
    await store.load()
  }
  async function addCat() {
    if (!newCat.trim()) return
    await addCategories([newCat])
    newCat = ''
    await store.load()
  }
</script>

<div class="page">
  <div class="topbar"><h1>Impostazioni</h1></div>

  <section class="card">
    <h2>Backup</h2>
    <p class="hint" style="margin-top:6px">
      {store.lastBackup ? `Ultimo backup: ${formatDate(store.lastBackup)}.` : 'Non hai ancora fatto nessun backup.'}
      {store.recipes.length} {store.recipes.length === 1 ? 'ricetta' : 'ricette'} nel ricettario.
    </p>
    <span class="lbl" style="margin-top:12px">Foto nel backup</span>
    <div class="chips">
      <button class="chip" aria-pressed={quality === 'piena'} onclick={() => (quality = 'piena')}>Qualità piena</button>
      <button class="chip" aria-pressed={quality === 'ridotta'} onclick={() => (quality = 'ridotta')}>Ridotte (file leggero)</button>
    </div>
    <button class="btn primary block" style="margin-top:12px" disabled={!!busy || store.recipes.length === 0} onclick={exportAll}>
      {busy === 'export' ? 'Preparo il backup…' : '💾 Salva il backup di tutto'}
    </button>
    <label class="btn block" style="margin-top:10px;text-align:center">
      {busy === 'import' ? 'Importo…' : '📥 Importa un file .ricettario'}
      <input type="file" hidden disabled={!!busy} onchange={importFile} />
    </label>
    <p class="hint">L'importazione unisce: non cancella mai nulla. Se una ricetta esiste già, resta la versione modificata più di recente.</p>
    {#if message}<p class="banner" role="status">{message}</p>{/if}
    {#if result}
      <div class="banner" role="status">
        <b>Importazione completata</b><br />
        Aggiunte: {result.added} · Aggiornate: {result.updated} · Saltate (già presenti): {result.skipped}
        {#if result.inboxAdded}<br />Foto da sistemare aggiunte: {result.inboxAdded}{/if}
        {#if result.missingPhotos}<br />Attenzione: {result.missingPhotos} {result.missingPhotos === 1 ? 'ricetta ha' : 'ricette hanno'} foto mancanti nel file.{/if}
      </div>
    {/if}
  </section>

  <section class="card">
    <h2>Spazio sul telefono</h2>
    {#if usage}
      <p style="margin:8px 0 0">Occupato: <b>{formatBytes(usage.used)}</b>{#if usage.quota} su circa {formatBytes(usage.quota)} disponibili{/if}.</p>
    {:else}
      <p class="hint">Non riesco a leggere lo spazio occupato su questo dispositivo.</p>
    {/if}
    <p class="hint">
      {#if store.persisted}Il telefono ha accettato di conservare i dati dell'app.
      {:else}Il telefono non ha (ancora) garantito di conservare i dati: per questo conviene fare ogni tanto un backup.{/if}
    </p>
  </section>

  <section class="card">
    <h2>Categorie</h2>
    <ul class="cats">
      {#each store.categories as c, i (c)}
        <li>
          <span>{c}</span>
          <button class="iconbtn" aria-label={`Sposta su ${c}`} disabled={i === 0} onclick={() => moveCat(i, -1)}>↑</button>
          <button class="iconbtn" aria-label={`Sposta giù ${c}`} disabled={i === store.categories.length - 1} onclick={() => moveCat(i, 1)}>↓</button>
          <button class="iconbtn" aria-label={`Rinomina ${c}`} onclick={() => rename(c)}>✎</button>
          <button class="iconbtn" aria-label={`Elimina ${c}`} onclick={() => removeCat(c)}>🗑</button>
        </li>
      {/each}
    </ul>
    <div class="row" style="flex-wrap:nowrap;margin-top:10px">
      <input class="input" placeholder="Nuova categoria…" bind:value={newCat} onkeydown={(e) => { if (e.key === 'Enter') void addCat() }} />
      <button class="btn" style="flex:none" onclick={addCat}>Aggiungi</button>
    </div>
  </section>

  <p class="hint" style="text-align:center">Ricettacolo · versione 0.1 · i dati restano solo su questo dispositivo.</p>
</div>

<style>
  .cats { list-style: none; margin: 8px 0 0; padding: 0; }
  .cats li { display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--line); }
  .cats li span { flex: 1; font-size: 18px; }
  .cats .iconbtn { width: 42px; height: 42px; font-size: 18px; }
</style>
