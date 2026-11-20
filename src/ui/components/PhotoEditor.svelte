<script lang="ts">
  import { onMount } from 'svelte'
  import { MAX_SIDE, decodeBlob, rotateToCanvas, scaleToCanvas, warpQuad } from '../../adapters/image/process'
  import { isConvex, type Pt, type Quad } from '../../adapters/image/geometry'

  let { blob, onconfirm, oncancel }: {
    blob: Blob
    onconfirm: (c: HTMLCanvasElement) => void
    oncancel: () => void
  } = $props()

  const PREVIEW = 1000
  let base = $state<HTMLCanvasElement | null>(null)
  let prev = $state<HTMLCanvasElement | null>(null)
  let canvasEl = $state<HTMLCanvasElement | null>(null)
  let svgEl = $state<SVGSVGElement | null>(null)
  let quarter = $state(0)
  let fine = $state(0)
  let mode = $state<'crop' | 'persp'>('crop')
  let quad = $state<Pt[]>([])
  let busy = $state(false)
  let error = $state('')
  let dragging = -1

  onMount(async () => {
    try {
      const bmp = await decodeBlob(blob)
      base = scaleToCanvas(bmp, MAX_SIDE)
      bmp.close()
    } catch {
      error = 'Non riesco ad aprire questa foto.'
    }
  })

  function fullFrame(w: number, h: number): Pt[] {
    return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
  }

  $effect(() => {
    if (!base) return
    const p = rotateToCanvas(base, quarter * 90 + fine, PREVIEW)
    prev = p
    quad = fullFrame(p.width, p.height)
  })

  $effect(() => {
    if (!prev || !canvasEl) return
    canvasEl.width = prev.width
    canvasEl.height = prev.height
    canvasEl.getContext('2d')!.drawImage(prev, 0, 0)
  })

  const W = $derived(prev?.width ?? 1)
  const H = $derived(prev?.height ?? 1)
  const R = $derived(Math.max(W, H) / 26)

  function setMode(m: 'crop' | 'persp') {
    if (m === mode) return
    mode = m
    if (m === 'crop') {
      const xs = quad.map((p) => p.x), ys = quad.map((p) => p.y)
      const l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys)
      quad = [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }]
    }
  }

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

  function down(e: PointerEvent, i: number) {
    dragging = i
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  function move(e: PointerEvent) {
    if (dragging < 0 || !svgEl) return
    const rc = svgEl.getBoundingClientRect()
    const x = clamp(((e.clientX - rc.left) / rc.width) * W, 0, W)
    const y = clamp(((e.clientY - rc.top) / rc.height) * H, 0, H)
    if (mode === 'persp') {
      quad[dragging] = { x, y }
      return
    }
    const min = 24
    let l = quad[0].x, r = quad[1].x, t = quad[0].y, b = quad[3].y
    if (dragging === 0 || dragging === 3) l = Math.min(x, r - min)
    else r = Math.max(x, l + min)
    if (dragging === 0 || dragging === 1) t = Math.min(y, b - min)
    else b = Math.max(y, t + min)
    quad = [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }]
  }
  const up = () => { dragging = -1 }

  function rotate90(d: number) { quarter = (quarter + d + 4) % 4 }
  function reset() { quarter = 0; fine = 0; mode = 'crop' }

  async function confirm() {
    if (!base || !prev || busy) return
    error = ''
    busy = true
    await new Promise((r) => setTimeout(r, 30)) // lascia disegnare "Un attimo…"
    try {
      const full = rotateToCanvas(base, quarter * 90 + fine, 2600)
      const k = full.width / prev.width
      const q = quad.map((p) => ({ x: p.x * k, y: p.y * k })) as Quad
      if (mode === 'persp' && !isConvex(q)) {
        error = 'I quattro angoli devono formare un quadrilatero (senza incroci).'
        return
      }
      onconfirm(warpQuad(full, q, MAX_SIDE))
    } catch (e) {
      error = `Errore: ${e instanceof Error ? e.message : e}`
    } finally {
      busy = false
    }
  }

  const outside = $derived(
    `M0 0H${W}V${H}H0Z M${quad.map((p, i) => `${i ? 'L' : ''}${p.x} ${p.y}`).join(' ')}Z`,
  )
</script>

<div class="ed" role="dialog" aria-modal="true" aria-label="Modifica foto">
  <header>
    <button class="btn" onclick={oncancel}>Annulla</button>
    <strong>Ritaglia e raddrizza</strong>
    <button class="btn primary" disabled={!prev || busy} onclick={confirm}>{busy ? 'Un attimo…' : 'Fatto'}</button>
  </header>

  <div class="area">
    {#if prev}
      <div class="stage">
        <canvas bind:this={canvasEl}></canvas>
        <svg bind:this={svgEl} viewBox={`0 0 ${W} ${H}`} style="touch-action:none">
          <path d={outside} fill="rgba(0,0,0,.55)" fill-rule="evenodd" />
          <polygon points={quad.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" stroke-width={R / 8} />
          {#each quad as p, i (i)}
            <circle role="slider" aria-label={`Angolo ${i + 1}`} aria-valuenow={0} tabindex="-1" cx={p.x} cy={p.y} r={R * 1.7} fill="transparent"
              onpointerdown={(e) => down(e, i)} onpointermove={move} onpointerup={up} onpointercancel={up} />
            <circle cx={p.x} cy={p.y} r={R * 0.7} fill="#c8322a" stroke="#fff" stroke-width={R / 6} pointer-events="none" />
          {/each}
        </svg>
      </div>
    {:else if error}
      <p style="color:#fff">{error}</p>
    {:else}
      <p style="color:#fff">Apro la foto…</p>
    {/if}
  </div>

  <footer>
    {#if error && prev}<p class="err">{error}</p>{/if}
    <div class="seg">
      <button aria-pressed={mode === 'crop'} onclick={() => setMode('crop')}>Ritaglio</button>
      <button aria-pressed={mode === 'persp'} onclick={() => setMode('persp')}>Prospettiva (4 angoli)</button>
    </div>
    <div class="rot">
      <button class="btn" aria-label="Ruota a sinistra di 90 gradi" onclick={() => rotate90(-1)}>⟲ 90°</button>
      <label class="fine">
        <span>Raddrizza {fine > 0 ? '+' : ''}{fine.toFixed(1)}°</span>
        <input type="range" min="-15" max="15" step="0.1" bind:value={fine} />
      </label>
      <button class="btn" aria-label="Ruota a destra di 90 gradi" onclick={() => rotate90(1)}>90° ⟳</button>
    </div>
    <button class="btn block" onclick={reset}>Ripristina</button>
  </footer>
</div>

<style>
  .ed { position: fixed; inset: 0; z-index: 100; background: #1b140f; color: #fff; display: flex; flex-direction: column;
    padding-top: env(safe-area-inset-top); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; }
  header strong { font-size: 16px; text-align: center; }
  header .btn { min-height: 44px; padding: 8px 14px; color: inherit; background: #3a2c22; border-color: #5a463a; }
  header .btn.primary { background: var(--accent); border-color: var(--accent); }
  .area { flex: 1; min-height: 0; display: grid; place-items: center; padding: 22px; overflow: hidden; }
  .stage { position: relative; display: inline-block; line-height: 0; }
  canvas { display: block; max-width: calc(100vw - 44px); max-height: calc(100dvh - 330px); background: #fff; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  footer { padding: 8px 14px calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 10px; background: #261b14; }
  footer .btn { min-height: 46px; color: inherit; background: #3a2c22; border-color: #5a463a; padding: 8px 14px; }
  .seg { display: flex; border: 1.5px solid #5a463a; border-radius: 12px; overflow: hidden; }
  .seg button { flex: 1; padding: 11px 6px; border: 0; background: none; color: #fff; font-size: 15px; }
  .seg button[aria-pressed="true"] { background: var(--accent); font-weight: 700; }
  .rot { display: flex; gap: 10px; align-items: center; }
  .fine { flex: 1; display: flex; flex-direction: column; font-size: 14px; text-align: center; }
  .fine input { width: 100%; accent-color: var(--accent); height: 34px; }
  .err { margin: 0; color: #ffb4a8; font-size: 15px; }
</style>
