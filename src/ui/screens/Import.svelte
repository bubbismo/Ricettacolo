<script lang="ts">
  import { onMount } from 'svelte'
  import { store } from '../../app/store.svelte'
  import { replace } from '../../app/router.svelte'
  import { importConfig } from '../../app/importService.svelte'
  import { importRecipe } from '../../adapters/importer/client'
  import { remoteToDraft } from '../../core/importMap'
  import { hostLabel } from '../../core/link'

  const pending = store.pendingImport
  const ctl = new AbortController()

  onMount(() => { void run() })

  async function run() {
    if (!pending) { replace('/nuova'); return }
    const res = await importRecipe(pending.link, { url: importConfig.url, key: importConfig.key }, ctl.signal)
    store.pendingImport = null
    if (res.ok) {
      const d = remoteToDraft(res.recipe)
      store.shareDraft = {
        link: pending.link, title: d.title || pending.title, source: d.source, mainIngredients: d.mainIngredients, text: d.text, notes: d.notes,
        imageUrl: res.recipe.image ?? undefined,
        notice: { kind: 'ok', text: `Ho letto la ricetta da ${d.source || hostLabel(pending.link)}. Controlla e correggi tutto prima di salvare.` },
      }
    } else if (res.code === 'cancelled') {
      store.shareDraft = { link: pending.link, title: pending.title, notes: '' }
    } else {
      // ripiego: il link resta comunque salvato nella ricetta
      const h = res.hints
      store.shareDraft = {
        link: pending.link, title: h?.title || pending.title, source: h?.site, notes: '', imageUrl: h?.image,
        notice: {
          kind: 'warn',
          text: res.code === 'no_recipe'
            ? `${res.message}${h ? ' Ho preso solo titolo e sito;' : ''} puoi incollare il testo della ricetta qui sotto. Il link resta salvato.`
            : `${res.message} Il link resta comunque salvato nella ricetta.`,
        },
      }
    }
    replace('/nuova')
  }
</script>

<div class="page wait" role="status" aria-live="polite">
  <div class="spin" aria-hidden="true"></div>
  <h1>Leggo la ricetta…</h1>
  {#if pending}<p class="hint">{hostLabel(pending.link)}</p>{/if}
  <button class="btn" onclick={() => ctl.abort()}>Annulla</button>
</div>

<style>
  .wait { min-height: 80dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
  .spin { width: 54px; height: 54px; border-radius: 50%; border: 5px solid var(--line); border-top-color: var(--accent); animation: spin .9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h1 { font-size: 24px; }
  @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 3s !important; animation-iteration-count: infinite !important; } }
</style>
