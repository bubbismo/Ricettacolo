export type AwakeMode = 'wakelock' | 'video' | 'none'

/**
 * Tiene lo schermo acceso. Usa la Wake Lock API; dove manca o non basta (iPhone, in particolare
 * quando l'app è installata) aggiunge un piccolo video muto in loop, creato al momento.
 */
export async function keepAwake(): Promise<{ mode: AwakeMode; release: () => void }> {
  let sentinel: WakeLockSentinel | null = null
  let released = false
  let video: HTMLVideoElement | null = null
  const hasApi = 'wakeLock' in navigator

  const acquire = async (): Promise<boolean> => {
    if (!hasApi) return false
    try { sentinel = await navigator.wakeLock.request('screen'); return true } catch { return false }
  }
  const onVisible = () => {
    if (document.visibilityState !== 'visible' || released) return
    void acquire()
    void video?.play().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisible)

  const lockOk = await acquire()
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!lockOk || isIos) video = await startVideoFallback()

  return {
    mode: lockOk ? 'wakelock' : video ? 'video' : 'none',
    release: () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
      if (video) { URL.revokeObjectURL(video.src); video.remove() }
    },
  }
}

async function startVideoFallback(): Promise<HTMLVideoElement | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') return null
    const ctx = canvas.getContext('2d')!
    const mime = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
    const rec = new MediaRecorder(canvas.captureStream(10), mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const stopped = new Promise<void>((res) => { rec.onstop = () => res() })
    rec.start()
    let n = 0
    const t = setInterval(() => { ctx.fillStyle = n++ % 2 ? '#000' : '#020202'; ctx.fillRect(0, 0, 32, 32) }, 100)
    await new Promise((r) => setTimeout(r, 1200))
    clearInterval(t)
    rec.stop()
    await stopped
    const v = document.createElement('video')
    v.src = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || mime }))
    v.muted = true
    v.loop = true
    v.setAttribute('playsinline', '')
    v.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:.01;pointer-events:none'
    document.body.appendChild(v)
    await v.play()
    return v
  } catch {
    return null
  }
}
