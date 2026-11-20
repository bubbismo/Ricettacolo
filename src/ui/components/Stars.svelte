<script lang="ts">
  import type { Rating } from '../../core/recipe'

  let { value = null, onchange }: { value: Rating | null; onchange?: (v: Rating | null) => void } = $props()
</script>

{#if onchange}
  <span class="stars" role="group" aria-label="Voto">
    {#each [1, 2, 3, 4, 5] as n (n)}
      <button type="button" class:on={(value ?? 0) >= n} aria-label={`${n} su 5`}
        onclick={() => onchange(value === n ? null : (n as Rating))}>★</button>
    {/each}
  </span>
{:else if value}
  <span class="stars small" aria-label={`Voto ${value} su 5`}>{'★'.repeat(value)}</span>
{/if}
