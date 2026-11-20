<script lang="ts">
  import { untrack } from 'svelte'
  import { store } from '../../app/store.svelte'
  import { go } from '../../app/router.svelte'
  import { pickNext } from '../../core/pick'
  import type { Recipe } from '../../core/recipe'
  import Photo from '../components/Photo.svelte'
  import Stars from '../components/Stars.svelte'

  let category = $state<string | null>(null)
  let minRating = $state(0)
  let current = $state<Recipe | null>(null)
  let seen = new Set<string>()

  function another() {
    const res = pickNext(store.recipes, { category, minRating }, seen, current?.id)
    seen = res.seen
    current = res.recipe
  }

  // cambiando i filtri si ricomincia il giro
  $effect(() => {
    void category; void minRating; void store.loaded
    untrack(() => { seen = new Set(); if (store.loaded) another() })
  })
</script>

<div class="page">
  <div class="topbar"><h1>Cosa cucino oggi?</h1></div>

  {#if store.categories.length}
    <div class="chips scroll" style="margin-bottom:8px">
      <button class="chip" aria-pressed={!category} onclick={() => (category = null)}>Tutte</button>
      {#each store.categories as c (c)}
        <button class="chip" aria-pressed={category === c} onclick={() => (category = category === c ? null : c)}>{c}</button>
      {/each}
    </div>
  {/if}
  <div class="chips" style="margin-bottom:14px">
    {#each [0, 3, 4, 5] as n (n)}
      <button class="chip" aria-pressed={minRating === n} onclick={() => (minRating = n)}>{n === 0 ? 'Qualsiasi voto' : `${n}★ e più`}</button>
    {/each}
  </div>

  {#if !store.loaded}
    <p class="hint">Caricamento…</p>
  {:else if !current}
    <div class="card" style="text-align:center">
      <p style="font-size:40px;margin:4px 0">🤷</p>
      <h2>Nessuna ricetta</h2>
      <p class="hint">{store.recipes.length ? 'Nessuna ricetta corrisponde ai filtri scelti.' : 'Il ricettario è ancora vuoto.'}</p>
    </div>
  {:else}
    {#key current.id}
      <button class="pick" onclick={() => go(`/r/${current!.id}`)}>
        <div class="img">{#if current.photoIds[0]}<Photo id={current.photoIds[0]} full alt="" />{:else}<span>🍽</span>{/if}</div>
        <div class="info">
          <h2>{current.title || 'Senza titolo'}</h2>
          {#if current.source}<small>{current.source}</small>{/if}
          <Stars value={current.rating} />
        </div>
      </button>
    {/key}
    <button class="btn primary block" style="margin-top:14px" onclick={another}>🎲 Un'altra</button>
    <div class="row" style="margin-top:10px">
      <button class="btn" onclick={() => go(`/r/${current!.id}`)}>Apri ricetta</button>
      {#if current.photoIds.length}<button class="btn" onclick={() => go(`/cucina/${current!.id}`)}>🍳 Cucina</button>{/if}
    </div>
  {/if}
</div>

<style>
  .pick { width: 100%; padding: 0; text-align: left; border: 1.5px solid var(--line); border-radius: 18px; overflow: hidden; background: var(--card); display: block; box-shadow: var(--shadow); }
  .img { aspect-ratio: 4 / 3; background: var(--line); display: grid; place-items: center; font-size: 56px; overflow: hidden; }
  .info { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 2px; }
  small { color: var(--muted); font-size: 15px; }
</style>
