import { describe, expect, it } from 'vitest'
import { applyH, fitWithin, isConvex, quadSize, rotatedBounds, squareToQuad, type Quad } from './geometry'

const trapezio: Quad = [{ x: 20, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]

describe('geometria', () => {
  it('l\'omografia manda gli angoli del quadrato negli angoli del quadrilatero', () => {
    const H = squareToQuad(trapezio)
    const near = (p: { x: number; y: number }, x: number, y: number) => {
      expect(p.x).toBeCloseTo(x, 6); expect(p.y).toBeCloseTo(y, 6)
    }
    near(applyH(H, 0, 0), 20, 0)
    near(applyH(H, 1, 0), 80, 0)
    near(applyH(H, 1, 1), 100, 100)
    near(applyH(H, 0, 1), 0, 100)
  })
  it('caso affine (rettangolo)', () => {
    const q: Quad = [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 60 }, { x: 10, y: 60 }]
    const p = applyH(squareToQuad(q), 0.5, 0.5)
    expect(p.x).toBeCloseTo(60); expect(p.y).toBeCloseTo(35)
  })
  it('dimensioni e convessità', () => {
    expect(quadSize(trapezio)).toEqual({ w: 80, h: 102 })
    expect(isConvex(trapezio)).toBe(true)
    expect(isConvex([trapezio[0], trapezio[2], trapezio[1], trapezio[3]])).toBe(false)
  })
  it('limiti di rotazione e ridimensionamento', () => {
    expect(rotatedBounds(100, 50, 90)).toEqual({ w: 50, h: 100 })
    expect(fitWithin(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 })
    expect(fitWithin(800, 600, 2000)).toEqual({ w: 800, h: 600 })
  })
})
