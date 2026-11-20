<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { store } from '../../app/store.svelte'
  import { back } from '../../app/router.svelte'
  import { getPhoto } from '../../adapters/storage/db'
  import { keepAwake, type AwakeMode } from '../../adapters/device/wakelock'
  import SpeechPlayer from '../components/SpeechPlayer.svelte'

  let { id }: { id: string } = $props()
  const r = $derived(store.byId(id))

  let urls = $state<string[]>([])
  let index = $state(0)
  let scale = $state(1)
  let tx = $state(0)
  let ty = $state(0)
  let dragDx = $state(0)
  let active = $state(false)
  let hint = $state(true)
  let awake = $state<AwakeMode | ''>('')
  let stage = $state<HTMLDivElement | null>(null)
  let release = () => {}

  onMount(() => {
    void keepAwake().then((k) => { awake = k.mode; release = k.release })
    const t = setTimeout(() => (hint = false), 5000)
    return () => clearTimeout(t)
  })
  onDestroy(() => { release(); urls.forEach((u) => URL.revokeObjectURL(u)) })

  let loadedFor = ''
  $effect(() => {
    const ids = r?.photoIds ?? []
    const key = ids.join(',')
    if (!r || key === loadedFor) return
    loadedFor = key
    void (async () => {
      const next: string[] = []
      for (const pid of ids) {
        const p = await getPhoto(pid)
        if (p) next.push(URL.createObjectURL(p.blob))
      }
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls = next
    })()
  })

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
  const resetZoom = () => { scale = 1; tx = 0; ty = 0 }

  function goPage(d: number) {
    const n = clamp(index + d, 0, Math.max(0, urls.length - 1))
    if (n !== index) { index = n; resetZoom() }
  }

  function clampPan() {
    if (!stage) return
    const rc = stage.getBoundingClientRect()
    const mx = ((scale - 1) * rc.width) / 2, my = ((scale - 1) * rc.height) / 2
    tx = clamp(tx, -mx, mx)
    ty = clamp(ty, -my, my)
  }

  // ---- gesti: pizzico a due dita, trascinamento da ingrandita, scorrimento tra le pagine, doppio tocco ----
  const pts = new Map<number, { x: number; y: number }>()
  let startDist = 1, startScale = 1, startTx = 0, startTy = 0
  let startMid = { x: 0, y: 0 }
  let swipeStart: { x: number; y: number } | null = null
  let moved = false
  let multi = false
  let lastTap = { t: 0, x: 0, y: 0 }

  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  function down(e: PointerEvent) {
    stage?.setPointerCapture(e.pointerId)
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    active = true
    if (pts.size === 1) { swipeStart = { x: e.clientX, y: e.clientY }; moved = false; multi = false }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]
      startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      startScale = scale; startTx = tx; startTy = ty; startMid = mid(a, b)
      swipeStart = null; dragDx = 0; multi = true; moved = true
    }
  }

  function move(e: PointerEvent) {
    const p = pts.get(e.pointerId)
    if (!p || !stage) return
    const px = p.x, py = p.y
    p.x = e.clientX; p.y = e.clientY
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()]
      const s = clamp((startScale * Math.hypot(a.x - b.x, a.y - b.y)) / startDist, 1, 6)
      const m = mid(a, b)
      const rc = stage.getBoundingClientRect()
      const cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2
      tx = m.x - cx - (startMid.x - cx - startTx) * (s / startScale)
      ty = m.y - cy - (startMid.y - cy - startTy) * (s / startScale)
      scale = s
    } else if (scale > 1) {
      tx += e.clientX - px; ty += e.clientY - py
      if (Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 0) moved = true
    } else if (swipeStart) {
      dragDx = e.clientX - swipeStart.x
      if (Math.abs(dragDx) > 8) moved = true
    }
  }

  function up(e: PointerEvent) {
    pts.delete(e.pointerId)
    if (pts.size > 0) return
    active = false
    if (scale < 1.05) resetZoom(); else clampPan()
    if (swipeStart && scale === 1 && !multi) {
      const dx = e.clientX - swipeStart.x, dy = e.clientY - swipeStart.y
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goPage(dx < 0 ? 1 : -1)
    }
    if (!moved && !multi) tap(e)
    swipeStart = null
    dragDx = 0
  }

  function tap(e: PointerEvent) {
    const now = Date.now()
    if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      if (scale > 1) resetZoom()
      else if (stage) {
        const rc = stage.getBoundingClientRect()
        scale = 2.5
        tx = -(e.clientX - (rc.left + rc.width / 2)) * 1.5
        ty = -(e.clientY - (rc.top + rc.height / 2)) * 1.5
        clampPan()
      }
      lastTap = { t: 0, x: 0, y: 0 }
    } else lastTap = { t: now, x: e.clientX, y: e.clientY }
  }

  function wheel(e: WheelEvent) {
    if (!stage) return
    const s = clamp(scale * Math.exp(-e.deltaY / 400), 1, 6)
    const rc = stage.getBoundingClientRect()
    const cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2
    tx = e.clientX - cx - (e.clientX - cx - tx) * (s / scale)
    ty = e.clientY - cy - (e.clientY - cy - ty) * (s / scale)
    scale = s
    if (s <= 1.02) resetZoom(); else clampPan()
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') goPage(1)
    else if (e.key === 'ArrowLeft') goPage(-1)
    else if (e.key === 'Escape') back(`/r/${id}`)
  }
</script>

<svelte:window onkeydown={key} />

<div class="cook">
  <div
    class="stage" bind:this={stage} role="application" aria-label="Pagina della ricetta: pizzica per ingrandire, scorri per cambiare pagina"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel}
  >
    {#if urls[index]}
      {#key index}<img class="pg" src={urls[index]} alt={`${r?.title ?? 'Ricetta'}, pagina ${index + 1}`} draggable="false"
        style={`transform: translate(${tx + dragDx}px, ${ty}px) scale(${scale}); transition: ${active ? 'none' : 'transform .18s ease-out'}`} />{/key}
    {:else if r && r.photoIds.length === 0}
      <p class="msg">Questa ricetta non ha foto.</p>
    {:else}
      <p class="msg">{store.loaded ? 'Carico la pagina…' : 'Carico…'}</p>
    {/if}
  </div>

  <header>
    <button class="rb" aria-label="Chiudi modalità cucina" onclick={() => back(`/r/${id}`)}>✕</button>
    <div class="t">
      <strong>{r?.title ?? ''}</strong>
      <small>{#if urls.length > 1}Pagina {index + 1} di {urls.length} · {/if}{awake === 'none' ? 'schermo non bloccabile' : awake ? '☀ schermo sempre acceso' : ''}</small>
    </div>
  </header>

  {#if urls.length > 1}
    <button class="nav l" aria-label="Pagina precedente" disabled={index === 0} onclick={() => goPage(-1)}>‹</button>
    <button class="nav r" aria-label="Pagina successiva" disabled={index === urls.length - 1} onclick={() => goPage(1)}>›</button>
  {/if}

  {#if r?.ocrText}<div class="speak"><SpeechPlayer text={r.ocrText} compact /></div>{/if}

  {#if hint}<p class="hint-bar" class:up={!!r?.ocrText}>Pizzica per ingrandire · doppio tocco per lo zoom{urls.length > 1 ? ' · scorri per cambiare pagina' : ''}</p>{/if}
</div>

<style>
  .cook { animation: fade-in .35s ease-out both; position: fixed; inset: 0; z-index: 50; background: #000; color: #fff; }
  .stage { position: absolute; inset: 0; touch-action: none; overflow: hidden; display: grid; place-items: center; user-select: none; -webkit-user-select: none; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; -webkit-user-drag: none; will-change: transform; }
  .pg { animation: fade-in .25s ease-out both; }
  .msg { color: #ccc; }
  header { position: absolute; top: 0; left: 0; right: 0; padding: calc(env(safe-area-inset-top) + 8px) 10px 24px; display: flex; gap: 10px; align-items: center;
    background: linear-gradient(#000a, #0000); pointer-events: none; }
  .rb, .nav { pointer-events: auto; border: 0; background: rgba(40, 30, 24, .75); color: #fff; font-size: 24px; width: 48px; height: 48px; border-radius: 14px; flex: none; }
  .t { display: flex; flex-direction: column; min-width: 0; }
  .t strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 17px; }
  .t small { color: #d8c8b4; font-size: 13px; }
  .nav { position: absolute; top: 50%; margin-top: -24px; width: 40px; height: 64px; margin-top: -32px; font-size: 32px; opacity: .8; }
  .nav.l { left: 4px; } .nav.r { right: 4px; }
  .nav:disabled { opacity: .2; }
  .speak { position: absolute; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom) + 12px); background: rgba(40, 30, 24, .85); padding: 8px; border-radius: 14px; }
  .hint-bar.up { bottom: calc(env(safe-area-inset-bottom) + 84px); }
  .hint-bar { position: absolute; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom) + 14px); margin: 0; text-align: center; background: rgba(40, 30, 24, .8); padding: 10px 12px; border-radius: 12px; font-size: 14px; pointer-events: none; }
</style>
