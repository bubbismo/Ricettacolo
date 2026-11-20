<script lang="ts">
  import { store } from '../../app/store.svelte'
  import { go } from '../../app/router.svelte'
  import { deleteInboxItem, putInboxItems } from '../../adapters/storage/db'
  import { processFile } from '../../adapters/image/process'
  import { importPdf, isPdf } from '../../adapters/pdf/importPdf'
  import { newId } from '../../core/recipe'
  import Photo from '../components/Photo.svelte'

  let progress = $state<{ done: number; total: number } | null>(null)
  let failed = $state<string[]>([])

  /** Una foto alla volta: se qualcosa va storto, quelle già salvate restano al sicuro. */
  async function add(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const files = [...(input.files ?? [])]
    input.value = ''
    if (!files.length) return
    failed = []
    progress = { done: 0, total: files.length }
    const base = Date.now()
    for (const [i, f] of files.entries()) {
      try {
        // un PDF diventa una foto per pagina (il testo, se c'è, si può rileggere dalle foto quando si sistema la ricetta)
        const nps = isPdf(f) ? (await importPdf(f)).photos : [await processFile(f)]
        for (const [k, np] of nps.entries()) {
          await putInboxItems([{ id: newId(), photoId: np.photo.id, addedAt: new Date(base + i * 1000 + k).toISOString() }], [np])
        }
        await store.load()
      } catch {
        failed.push(f.name || `foto ${i + 1}`)
      }
      progress = { done: i + 1, total: files.length }
    }
    progress = null
  }

  async function discard(id: string) {
    if (!confirm('Scartare questa foto? Non si può annullare.')) return
    await deleteInboxItem(id)
    await store.load()
  }
</script>

<div class="page">
  <div class="topbar"><h1>Da sistemare</h1></div>
  <p class="hint" style="margin-top:-6px">Metti qui le foto delle pagine, anche tante insieme. Poi le trasformi in ricette con calma, una alla volta.</p>

  <div class="row" style="margin:12px 0">
    <label class="btn" style="text-align:center">🖼 Dalla galleria
      <input type="file" accept="image/*,application/pdf" multiple hidden disabled={!!progress} onchange={add} />
    </label>
    <label class="btn" style="text-align:center">📷 Scatta
      <input type="file" accept="image/*" capture="environment" hidden disabled={!!progress} onchange={add} />
    </label>
  </div>

  {#if progress}
    <div class="banner" role="status">Preparo le foto… {progress.done} di {progress.total}
      <progress value={progress.done} max={progress.total} style="width:100%"></progress>
    </div>
  {/if}
  {#if failed.length}
    <div class="banner" role="alert">Non sono riuscita a leggere: {failed.join(', ')}. Prova con foto JPEG o PNG.</div>
  {/if}

  {#if store.inbox.length === 0 && !progress}
    <div class="card" style="text-align:center">
      <p style="font-size:40px;margin:4px 0">📥</p>
      <h2>Niente da sistemare</h2>
      <p class="hint">Quando aggiungi delle foto compaiono qui.</p>
    </div>
  {:else}
    <p class="hint" style="margin:0 0 8px">{store.inbox.length} {store.inbox.length === 1 ? 'foto' : 'foto'} · tocca una foto per farne una ricetta</p>
    <ul class="grid">
      {#each store.inbox as it, i (it.id)}
        <li>
          <button class="th" onclick={() => go(`/sistema/${it.id}`)} aria-label={`Sistema la foto ${i + 1}`}>
            <Photo id={it.photoId} alt="" />
            <span class="n">{i + 1}</span>
          </button>
          <button class="x" aria-label={`Scarta la foto ${i + 1}`} onclick={() => discard(it.id)}>🗑</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  li { position: relative; }
  .th { width: 100%; aspect-ratio: 3 / 4; padding: 0; border: 1.5px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--line); display: block; position: relative; }
  .n { position: absolute; left: 6px; top: 6px; background: rgba(0, 0, 0, .6); color: #fff; font-size: 13px; padding: 1px 8px; border-radius: 99px; }
  .x { position: absolute; right: 4px; bottom: 4px; width: 44px; height: 44px; border-radius: 12px; border: 0; background: rgba(255, 250, 240, .92); font-size: 20px; }
</style>
