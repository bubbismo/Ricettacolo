import type { PhotoRecord, ThumbRecord } from '../../core/recipe'
import { newId } from '../../core/recipe'
import { sha256Hex } from '../../core/hash'
import { applyH, fitWithin, quadSize, rotatedBounds, squareToQuad, type Quad } from './geometry'

export const MAX_SIDE = 2000
export const THUMB_SIDE = 400
export const JPEG_QUALITY = 0.85

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Decodifica una foto rispettando l'orientamento EXIF. */
export async function decodeBlob(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

export function canvasToBlob(c: HTMLCanvasElement, quality = JPEG_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Impossibile creare la foto'))), 'image/jpeg', quality))
}

/** Disegna la sorgente scalata (lato lungo ≤ max) su un canvas con sfondo bianco (il JPEG non ha trasparenza). */
export function scaleToCanvas(src: CanvasImageSource & { width: number; height: number }, max: number): HTMLCanvasElement {
  const { w, h } = fitWithin(src.width, src.height, max)
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, w, h)
  return c
}

/** Da un canvas finito crea foto compressa + miniatura pronte da salvare. */
export async function buildPhoto(canvas: HTMLCanvasElement): Promise<{ photo: PhotoRecord; thumb: ThumbRecord }> {
  const scaled = Math.max(canvas.width, canvas.height) > MAX_SIDE ? scaleToCanvas(canvas, MAX_SIDE) : canvas
  const blob = await canvasToBlob(scaled)
  const thumbBlob = await canvasToBlob(scaleToCanvas(scaled, THUMB_SIDE), 0.8)
  const id = newId()
  return {
    photo: {
      id, blob, mime: 'image/jpeg', width: scaled.width, height: scaled.height,
      sha256: await sha256Hex(await blob.arrayBuffer()), createdAt: new Date().toISOString(),
    },
    thumb: { photoId: id, blob: thumbBlob },
  }
}

/** Foto scelta o scattata → versione ridimensionata e compressa. */
export async function processFile(file: Blob): Promise<{ photo: PhotoRecord; thumb: ThumbRecord }> {
  const bmp = await decodeBlob(file)
  try {
    return await buildPhoto(scaleToCanvas(bmp, MAX_SIDE))
  } finally {
    bmp.close()
  }
}

/** Ruota la sorgente di `deg` gradi (90·k + regolazione fine) su un canvas che la contiene tutta. */
export function rotateToCanvas(src: HTMLCanvasElement | ImageBitmap, deg: number, max: number): HTMLCanvasElement {
  const b = rotatedBounds(src.width, src.height, deg)
  const k = Math.min(1, max / Math.max(b.w, b.h))
  const c = makeCanvas(Math.max(1, Math.round(b.w * k)), Math.max(1, Math.round(b.h * k)))
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.scale(k, k)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return c
}

/** Ritaglia un quadrilatero qualunque raddrizzandolo (campionamento bilineare). Se è un rettangolo orizzontale fa un semplice ritaglio. */
export function warpQuad(src: HTMLCanvasElement, quad: Quad, maxSide = MAX_SIDE): HTMLCanvasElement {
  const [tl, tr, br, bl] = quad
  const axisAligned = Math.abs(tl.y - tr.y) < 0.5 && Math.abs(bl.y - br.y) < 0.5 &&
    Math.abs(tl.x - bl.x) < 0.5 && Math.abs(tr.x - br.x) < 0.5
  if (axisAligned) {
    const w = Math.max(1, Math.round(tr.x - tl.x)), h = Math.max(1, Math.round(bl.y - tl.y))
    const c = makeCanvas(w, h)
    c.getContext('2d')!.drawImage(src, Math.round(tl.x), Math.round(tl.y), w, h, 0, 0, w, h)
    return c
  }
  const nat = quadSize(quad)
  const { w, h } = fitWithin(nat.w, nat.h, maxSide)
  const out = makeCanvas(w, h)
  const sctx = src.getContext('2d')!
  const sd = sctx.getImageData(0, 0, src.width, src.height)
  const octx = out.getContext('2d')!
  const od = octx.createImageData(w, h)
  const H = squareToQuad(quad)
  const sw = src.width, sh = src.height
  const s = sd.data, o = od.data
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h
    for (let x = 0; x < w; x++) {
      const p = applyH(H, (x + 0.5) / w, v)
      const fx = Math.min(sw - 1, Math.max(0, p.x - 0.5)), fy = Math.min(sh - 1, Math.max(0, p.y - 0.5))
      const x0 = Math.floor(fx), y0 = Math.floor(fy)
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1)
      const ax = fx - x0, ay = fy - y0
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4
      const oi = (y * w + x) * 4
      for (let ch = 0; ch < 3; ch++) {
        o[oi + ch] = (s[i00 + ch] * (1 - ax) + s[i10 + ch] * ax) * (1 - ay) + (s[i01 + ch] * (1 - ax) + s[i11 + ch] * ax) * ay
      }
      o[oi + 3] = 255
    }
  }
  octx.putImageData(od, 0, 0)
  return out
}

export async function makeThumb(blob: Blob): Promise<Blob> {
  const bmp = await decodeBlob(blob)
  try {
    return await canvasToBlob(scaleToCanvas(bmp, THUMB_SIDE), 0.8)
  } finally {
    bmp.close()
  }
}

/** Versione più piccola e compressa di una foto (backup "ridotti", PDF molto grandi). */
export async function shrinkPhoto(blob: Blob, maxSide: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await decodeBlob(blob)
  try {
    const c = scaleToCanvas(bmp, maxSide)
    return { blob: await canvasToBlob(c, quality), width: c.width, height: c.height }
  } finally {
    bmp.close()
  }
}

/** Versione alleggerita per i backup "ridotti". */
export const reducePhoto = (blob: Blob) => shrinkPhoto(blob, 1000, 0.7)
