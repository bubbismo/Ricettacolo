<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Reader, speechSupported, type ReaderState } from '../../adapters/device/speech'

  let { text, compact = false }: { text: string; compact?: boolean } = $props()
  let phase = $state<ReaderState>('idle')
  const supported = speechSupported()
  let failed = $state(false)
  const reader = new Reader((s) => { phase = s; if (s === 'playing') failed = false }, () => (failed = true))
  onDestroy(() => { if (supported) reader.stop() })
</script>

{#if supported}
  <div class="sp" class:compact role="group" aria-label="Lettura a voce">
    {#if phase === 'playing'}
      <button class="btn" onclick={() => reader.pause()}>⏸ Pausa</button>
    {:else}
      <button class="btn primary" onclick={() => reader.play(text)}>▶ {phase === 'paused' ? 'Riprendi' : 'Ascolta'}</button>
    {/if}
    <button class="btn" disabled={phase === 'idle'} onclick={() => reader.stop()}>⏹ Stop</button>
  </div>
  {#if failed}<p class="fail" role="alert">Non riesco a leggere a voce: controlla che il telefono abbia una voce italiana (Impostazioni → Accessibilità → Sintesi vocale) e che il volume sia alto.</p>{/if}
{/if}

<style>
  .fail { margin: 8px 0 0; font-size: 14px; color: var(--accent); }
  .sp { display: flex; gap: 10px; }
  .sp .btn { flex: 1; }
  .compact .btn { min-height: 44px; padding: 6px 12px; font-size: 16px; }
</style>
