<script lang="ts">
  /**
   * Fumo "a cartoni animati": poche volute a S con contorno scuro e riempimento chiaro, come l'icona.
   * Si muovono solo con spostamento, rotazione e trasparenza (le animazioni più leggere per il telefono):
   * niente sfocature, niente gradienti grandi.
   * Poche volute lente che salgono in continuazione (oggi: la pentolina del ricettario vuoto).
   */
  let { count, size = 260, tone = 'icon' }: {
    count?: number
    /** idle: dimensione di riferimento in px del contenitore */
    size?: number
    /** icon: contorno marrone come l'icona; soft: contorno più tenue (su fondi chiari piccoli) */
    tone?: 'icon' | 'soft'
  } = $props()

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)

  const wisps = $derived.by(() =>
    Array.from({ length: count ?? 3 }, (_, i) => ({
      x: `${34 + i * (32 / Math.max(1, (count ?? 3) - 1))}%`, y: '84%', w: `${size * rnd(0.1, 0.14)}px`, t: `${rnd(3200, 4400)}ms`, d: `${-i * 1300}ms`,
      dx: `${size * rnd(-0.04, 0.04)}px`, dy: `${-size * rnd(0.3, 0.42)}px`, r: `${rnd(-6, 6)}deg`, flip: i % 2 === 1,
    })),
  )
</script>

{#if !reduce}
  <div class="steam" class:soft={tone === 'soft'} aria-hidden="true">
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
  .rise { position: absolute; left: var(--x); bottom: var(--y); width: var(--w); opacity: 0; will-change: transform, opacity;
    animation: idle var(--t) var(--d) ease-out infinite; }
  .sway { display: block; transform-origin: 50% 100%; animation: sway 1.6s ease-in-out infinite alternate; }
  .sway.flip { transform: scaleX(-1); animation-name: sway-flip; }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .out { stroke: #5a3a22; stroke-width: 13; }
  .in { stroke: #fffaf0; stroke-width: 6.5; }
  .soft .out { stroke: #b59a7e; stroke-width: 11; }
  .soft .in { stroke: #fff; stroke-width: 5.5; }

  @keyframes idle {
    0% { opacity: 0; transform: translate3d(-50%, 0, 0) scale(.7); }
    25% { opacity: 1; }
    75% { opacity: .9; }
    100% { opacity: 0; transform: translate3d(calc(-50% + var(--dx)), var(--dy), 0) scale(1.05) rotate(var(--r)); }
  }
  @keyframes sway { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
  @keyframes sway-flip { from { transform: scaleX(-1) rotate(-5deg); } to { transform: scaleX(-1) rotate(5deg); } }
</style>
