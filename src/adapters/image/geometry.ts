/** Geometria pura per il raddrizzamento della prospettiva (testabile senza browser). */

export interface Pt { x: number; y: number }
/** Angoli in ordine: alto-sinistra, alto-destra, basso-destra, basso-sinistra */
export type Quad = [Pt, Pt, Pt, Pt]

export interface Homography { a: number; b: number; c: number; d: number; e: number; f: number; g: number; h: number }

/** Omografia dal quadrato unitario (u,v) al quadrilatero (Heckbert). */
export function squareToQuad(q: Quad): Homography {
  const [p0, p1, p2, p3] = q
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return { a: p1.x - p0.x, b: p2.x - p1.x, c: p0.x, d: p1.y - p0.y, e: p2.y - p1.y, f: p0.y, g: 0, h: 0 }
  }
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y
  const den = dx1 * dy2 - dx2 * dy1
  const g = (sx * dy2 - dx2 * sy) / den
  const h = (dx1 * sy - sx * dy1) / den
  return {
    a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y, g, h,
  }
}

export function applyH(H: Homography, u: number, v: number): Pt {
  const w = H.g * u + H.h * v + 1
  return { x: (H.a * u + H.b * v + H.c) / w, y: (H.d * u + H.e * v + H.f) / w }
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Dimensioni naturali dell'immagine raddrizzata (media dei lati opposti). */
export function quadSize(q: Quad): { w: number; h: number } {
  return {
    w: Math.max(1, Math.round((dist(q[0], q[1]) + dist(q[3], q[2])) / 2)),
    h: Math.max(1, Math.round((dist(q[0], q[3]) + dist(q[1], q[2])) / 2)),
  }
}

/** Il quadrilatero è convesso e non degenere? (altrimenti la prospettiva non ha senso) */
export function isConvex(q: Quad): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-6) return false
    const s = Math.sign(cross)
    if (sign && s !== sign) return false
    sign = s
  }
  return true
}

/** Dimensioni di un rettangolo ruotato di `deg` gradi che contiene l'immagine w×h. */
export function rotatedBounds(w: number, h: number, deg: number): { w: number; h: number } {
  const r = (deg * Math.PI) / 180
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r))
  return { w: Math.ceil(w * c + h * s - 1e-6), h: Math.ceil(w * s + h * c - 1e-6) }
}

/** Ridimensiona w×h in modo che il lato lungo non superi `max`. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}
