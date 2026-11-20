<script lang="ts">
  /**
   * Fumo "a cartoni animati": poche volute a S con contorno scuro e riempimento chiaro, come l'icona.
   * Si muovono solo con spostamento, rotazione e trasparenza (le animazioni più leggere per il telefono):
   * niente sfocature, niente gradienti grandi.
   * - idle: tre volute lente che salgono in continuazione
   * - burst: una decina di volute grandi che salgono e si dissolvono (transizione)
   */
  let { mode = 'idle', count, size = 260, tone = 'icon' }: {
    mode?: 'idle' | 'burst'
    count?: number
    /** idle: dimensione di riferimento in px del contenitore */
    size?: number
    /** icon: contorno marrone come l'icona; soft: contorno più tenue (su fondi chiari piccoli) */
    tone?: 'icon' | 'soft'
  } = $props()

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)

  const wisps = $derived.by(() => {
    const n = count ?? (mode === 'burst' ? 8 : 3)
    return Array.from({ length: n }, (_, i) =>
      mode === 'burst'
        ? { x: `${8 + (84 * (i + rnd(0.1, 0.9))) / n}%`, y: `${rnd(2, 32)}%`, w: `${rnd(8, 14)}vmin`, t: `${rnd(1000, 1300)}ms`, d: `${rnd(0, 320)}ms`,
            dx: `${rnd(-7, 7)}vmin`, dy: `${-rnd(28, 48)}vh`, r: `${rnd(-9, 9)}deg`, flip: i % 2 === 1 }
        : { x: `${34 + i * (32 / Math.max(1, n - 1))}%`, y: '84%', w: `${size * rnd(0.1, 0.14)}px`, t: `${rnd(3200, 4400)}ms`, d: `${-i * 1300}ms`,
            dx: `${size * rnd(-0.04, 0.04)}px`, dy: `${-size * rnd(0.3, 0.42)}px`, r: `${rnd(-6, 6)}deg`, flip: i % 2 === 1 },
    )
  })
</script>

{#if !reduce}
  <div class="steam" class:burst={mode === 'burst'} class:soft={tone === 'soft'} aria-hidden="true">
    {#each wisps as w, i (i)}
      <span class="rise" style={`--x:${w.x};--y:${w.y};--w:${w.w};--t:${w.t};--d:${w.d};--dx:${w.dx};--dy:${w.dy};--r:${w.r}`}>
        <span class="sway" class:flip={w.flip}>
          <svg viewBox="0 0 44 124" focusable="false">
            <path class="out" d="M22 118 C4 98 40 84 22 64 S4 30 22 8" />
            <path class="in" d="M22 118 C4 98 40 84 22 64 S4 30 22 8" />
          </svg>
        </span>
      </span>
    {/each}
  </div>
{/if}

<style>
  .steam { position: absolute; inset: 0; pointer-events: none; }
  .steam.burst { position: fixed; z-index: 3; overflow: hidden; }
  .rise { position: absolute; left: var(--x); bottom: var(--y); width: var(--w); opacity: 0; will-change: transform, opacity;
    animation: idle var(--t) var(--d) ease-out infinite; }
  .burst .rise { animation: burst var(--t) var(--d) cubic-bezier(.2, .6, .3, 1) forwards; }
  .sway { display: block; transform-origin: 50% 100%; animation: sway 1.6s ease-in-out infinite alternate; }
  .sway.flip { transform: scaleX(-1); animation-name: sway-flip; }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .out { stroke: #5a3a22; stroke-width: 13; }
  .in { stroke: #fffaf0; stroke-width: 6.5; }
  .burst .out { stroke: #8a6a4c; stroke-width: 9; }
  .burst .in { stroke-width: 4.5; }
  .soft .out { stroke: #b59a7e; stroke-width: 11; }
  .soft .in { stroke: #fff; stroke-width: 5.5; }

  @keyframes idle {
    0% { opacity: 0; transform: translate3d(-50%, 0, 0) scale(.7); }
    25% { opacity: 1; }
    75% { opacity: .9; }
    100% { opacity: 0; transform: translate3d(calc(-50% + var(--dx)), var(--dy), 0) scale(1.05) rotate(var(--r)); }
  }
  @keyframes burst {
    0% { opacity: 0; transform: translate3d(-50%, 0, 0) scale(.5); }
    22% { opacity: 1; }
    55% { opacity: .9; }
    100% { opacity: 0; transform: translate3d(calc(-50% + var(--dx)), var(--dy), 0) scale(1.15) rotate(var(--r)); }
  }
  @keyframes sway { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
  @keyframes sway-flip { from { transform: scaleX(-1) rotate(-5deg); } to { transform: scaleX(-1) rotate(5deg); } }
</style>
