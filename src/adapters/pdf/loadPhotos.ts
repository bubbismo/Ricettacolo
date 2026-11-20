import type { Recipe } from '../../core/recipe'
import { getPhoto } from '../storage/db'
import { decodeBlob, shrinkPhoto } from '../image/process'
import type { PdfRecipe } from './recipePdf'

/** Sopra questo numero di foto il PDF si alleggerisce, per non riempire la memoria del telefono. */
const BULK_PHOTOS = 12

/** Legge dall'archivio le foto delle ricette, pronte per il PDF. */
export async function loadForPdf(recipes: Recipe[], onProgress?: (done: number, total: number) => void): Promise<PdfRecipe[]> {
  const shrink = recipes.reduce((n, r) => n + r.photoIds.length, 0) > BULK_PHOTOS
  const out: PdfRecipe[] = []
  for (const [i, recipe] of recipes.entries()) {
    const photos: PdfRecipe['photos'] = []
    for (const id of recipe.photoIds) {
      const p = await getPhoto(id)
      if (!p) continue
      if (shrink) {
        const s = await shrinkPhoto(p.blob, 1600, 0.75)
        photos.push({ bytes: new Uint8Array(await s.blob.arrayBuffer()), width: s.width, height: s.height })
        continue
      }
      let { width, height } = p
      if (!width || !height) {
        const bmp = await decodeBlob(p.blob)
        ;({ width, height } = bmp)
        bmp.close()
      }
      photos.push({ bytes: new Uint8Array(await p.blob.arrayBuffer()), width, height })
    }
    out.push({ recipe, photos })
    onProgress?.(i + 1, recipes.length)
  }
  return out
}
