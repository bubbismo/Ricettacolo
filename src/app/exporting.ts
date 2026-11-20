import type { Recipe } from '../core/recipe'
import { backupFileName, buildRicettario } from '../adapters/backup/ricettario'
import { deliver } from '../adapters/device/files'
import { reducePhoto } from '../adapters/image/process'
import { loadForPdf, loadLogo } from '../adapters/pdf/loadPhotos'

export type Status = (text: string) => void

/** PDF di una o più ricette, passato alla condivisione di sistema (o scaricato). */
export async function exportPdf(recipes: Recipe[], status: Status = () => {}): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { buildPdf, pdfFileName } = await import('../adapters/pdf/recipePdf')
  const sorted = recipes.length > 1 ? [...recipes].sort((a, b) => a.title.localeCompare(b.title, 'it', { sensitivity: 'base' })) : recipes
  const items = await loadForPdf(sorted, (d, t) => status(`Preparo le foto… ${d} di ${t}`))
  const blob = await buildPdf(items, { logo: await loadLogo(), onProgress: (d, t) => status(`Impagino… ${d} di ${t}`) })
  status('')
  return deliver(blob, pdfFileName(sorted), { preferShare: true })
}

/** Pacchetto reimportabile in un'altra copia dell'app: solo download (la condivisione di sistema rifiuta questo tipo di file). */
export async function exportPackage(recipes: Recipe[]): Promise<void> {
  const blob = await buildRicettario({ ids: recipes.map((r) => r.id), photoQuality: 'piena', deps: { reduce: reducePhoto } })
  await deliver(blob, recipes.length === 1 ? backupFileName('una', recipes[0].title) : backupFileName('tutto'))
}
