<script lang="ts">
  /**
   * Fumo che sale, fatto di macchie morbide (gradienti radiali: leggerissimo da animare).
   * - idle: poche volute lente e continue (un piatto che fuma)
   * - burst: una nuvola più fitta che copre lo schermo e si dissolve (transizione)
   */
  let { mode = 'idle', count, size = 260, tone = 'white' }: {
    mode?: 'idle' | 'burst'
    count?: number
    /** idle: dimensione di riferimento in px del contenitore */
    size?: number
    tone?: 'white' | 'tan'
  } = $props()

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  const wisps = $derived.by(() => Array.from({ length: count ?? (mode === 'burst' ? 22 : 5) }, (_, i) =>
    mode === 'burst'
      ? { x: `${rnd(6, 94)}%`, y: `${rnd(-18, 30)}%`, w: `${rnd(52, 95)}vmin`, t: `${rnd(950, 1350)}ms`, d: `${rnd(0, 380)}ms`,
          dx: `${rnd(-10, 10)}vmin`, dy: `${-rnd(30, 62)}vh`, o: rnd(0.85, 1), tan: i % 2 === 0 }
      : { x: `${rnd(40, 62)}%`, y: `${rnd(22, 38)}%`, w: `${size * rnd(0.2, 0.36)}px`, t: `${rnd(4200, 6600)}ms`, d: `${-rnd(0, 5000)}ms`,
          dx: `${size * rnd(-0.08, 0.08)}px`, dy: `${-size * rnd(0.45, 0.8)}px`, o: rnd(0.6, 0.85), tan: tone === 'tan' || i % 2 === 1 },
  ))
</script>

{#if !reduce}
  <div class="steam" class:burst={mode === 'burst'} aria-hidden="true">
    {#each wisps as w, i (i)}
      <i class="w" class:tan={w.tan} style={`--x:${w.x};--y:${w.y};--w:${w.w};--t:${w.t};--d:${w.d};--dx:${w.dx};--dy:${w.dy};--o:${w.o}`}></i>
    {/each}
  </div>
{/if}

<style>
  .steam { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
  .steam.burst { position: fixed; z-index: 3; overflow: hidden; }
  .w { position: absolute; left: var(--x); bottom: var(--y); width: var(--w); height: calc(var(--w) * 1.35); border-radius: 50%;
    background: radial-gradient(closest-side, rgba(255, 255, 255, .95) 0%, rgba(255, 248, 236, .6) 55%, rgba(255, 248, 236, 0) 100%);
    opacity: 0; transform: translate(-50%, 0) scale(.5); will-change: transform, opacity;
    animation: idle var(--t) var(--d) ease-out infinite; }
  .w.tan { background: radial-gradient(closest-side, rgba(150, 118, 86, .6) 0%, rgba(150, 118, 86, .26) 55%, rgba(150, 118, 86, 0) 100%); }
  .burst .w { animation: burst var(--t) var(--d) ease-out forwards; }
  .burst .w.tan { background: radial-gradient(closest-side, rgba(168, 134, 100, .75) 0%, rgba(168, 134, 100, .32) 55%, rgba(176, 146, 114, 0) 100%); }
  @keyframes idle {
    0% { opacity: 0; transform: translate(-50%, 0) scale(.5); }
    30% { opacity: var(--o); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), var(--dy)) scale(1.6); }
  }
  @keyframes burst {
    0% { opacity: 0; transform: translate(-50%, 0) scale(.45); }
    28% { opacity: var(--o); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), var(--dy)) scale(1.7); }
  }
</style>
