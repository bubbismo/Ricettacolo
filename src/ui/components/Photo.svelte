<script lang="ts">
  import { getPhoto, getThumb } from '../../adapters/storage/db'

  let { id, full = false, alt = '', cls = '' }: { id: string; full?: boolean; alt?: string; cls?: string } = $props()
  let url = $state('')

  $effect(() => {
    let alive = true
    let u = ''
    void (async () => {
      const blob = full ? (await getPhoto(id))?.blob : ((await getThumb(id)) ?? (await getPhoto(id))?.blob)
      if (blob && alive) { u = URL.createObjectURL(blob); url = u }
    })()
    return () => { alive = false; if (u) URL.revokeObjectURL(u) }
  })
</script>

{#if url}
  <img src={url} {alt} class={cls} draggable="false" />
{:else}
  <div class="ph {cls}" aria-hidden="true"></div>
{/if}

<style>
  img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .ph { width: 100%; height: 100%; min-height: 80px; background: var(--line); opacity: .5; }
</style>
