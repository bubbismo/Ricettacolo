import type { Recipe } from '../../core/recipe'
import { getPhoto } from '../storage/db'
import { decodeBlob } from '../image/process'
import type { PdfRecipe } from './recipePdf'

/** Legge dall'archivio le foto delle ricette, pronte per il PDF. */
export async function loadForPdf(recipes: Recipe[]): Promise<PdfRecipe[]> {
  const out: PdfRecipe[] = []
  for (const recipe of recipes) {
    const photos: PdfRecipe['photos'] = []
    for (const id of recipe.photoIds) {
      const p = await getPhoto(id)
      if (!p) continue
      let { width, height } = p
      if (!width || !height) {
        const bmp = await decodeBlob(p.blob)
        ;({ width, height } = bmp)
        bmp.close()
      }
      photos.push({ bytes: new Uint8Array(await p.blob.arrayBuffer()), width, height })
    }
    out.push({ recipe, photos })
  }
  return out
}
