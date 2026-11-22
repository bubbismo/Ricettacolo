import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { contentHash, sha256Hex } from '../../core/hash'
import { decideMerge, type MergeSummary } from '../../core/merge'
import { migrateRecipe } from '../../core/migrations'
import { SCHEMA_VERSION, type InboxItem, type PhotoRecord, type Recipe, type ThumbRecord } from '../../core/recipe'
import * as db from '../storage/db'

/** Formato proprio: uno zip (estensione .ricettario) con ricettario.json e le foto in foto/<id>.jpg */
export const FORMAT = 'ricettacolo'
/** 2: le ricette hanno il campo `link`. Si leggono anche i file di versione 1. */
export const FORMAT_VERSION = 2
export const EXTENSION = '.ricettario'
const JSON_NAME = 'ricettario.json'

export type PhotoQuality = 'piena' | 'ridotta'
export type Scope = 'ricetta' | 'selezione' | 'tutto'

interface PhotoMeta { id: string; mime: string; width: number; height: number; sha256: string; createdAt: string }

interface BackupFile {
  format: string
  formatVersion: number
  schemaVersion: number
  exportedAt: string
  scope: Scope
  photoQuality: PhotoQuality
  categories: string[]
  recipes: Recipe[]
  photos: PhotoMeta[]
  inbox: InboxItem[]
}

/** Dipendenze del browser, iniettabili nei test. */
export interface ImageDeps {
  makeThumb(blob: Blob): Promise<Blob>
  /** versione ridotta (lato lungo ≈1000 px, JPEG più compresso) */
  reduce(blob: Blob): Promise<{ blob: Blob; width: number; height: number }>
}

export async function buildRicettario(
  opts: { ids?: string[]; photoQuality: PhotoQuality; deps: Pick<ImageDeps, 'reduce'> },
): Promise<Blob> {
  const data = await db.readForExport(opts.ids)
  const scope: Scope = !opts.ids ? 'tutto' : opts.ids.length === 1 ? 'ricetta' : 'selezione'
  const files: Zippable = {}
  const photos: PhotoMeta[] = []
  for (const p of data.photos) {
    let blob = p.blob, width = p.width, height = p.height
    if (opts.photoQuality === 'ridotta') ({ blob, width, height } = await opts.deps.reduce(p.blob))
    files[`foto/${p.id}.jpg`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
    photos.push({ id: p.id, mime: p.mime, width, height, sha256: p.sha256, createdAt: p.createdAt })
  }
  const body: BackupFile = {
    format: FORMAT, formatVersion: FORMAT_VERSION, schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(), scope, photoQuality: opts.photoQuality,
    categories: data.categories, recipes: data.recipes, photos, inbox: data.inbox,
  }
  files[JSON_NAME] = [strToU8(JSON.stringify(body)), { level: 6 }]
  const zipped = zipSync(files)
  return new Blob([zipped as BlobPart], { type: 'application/zip' })
}

export interface ImportResult extends MergeSummary {
  inboxAdded: number
  /** ricette importate con foto mancanti nel file */
  missingPhotos: number
}

export class BackupError extends Error {}

export async function importRicettario(file: Blob, deps: Pick<ImageDeps, 'makeThumb'>): Promise<ImportResult> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new BackupError('Il file non è un ricettario valido.')
  }
  const jsonBytes = entries[JSON_NAME]
  if (!jsonBytes) throw new BackupError('Il file non è un ricettario valido.')
  let body: Partial<BackupFile>
  try {
    body = JSON.parse(strFromU8(jsonBytes))
  } catch {
    throw new BackupError('Il file non è un ricettario valido.')
  }
  if (body.format !== FORMAT || !Array.isArray(body.recipes)) throw new BackupError('Il file non è un ricettario valido.')
  if ((body.formatVersion ?? 1) > FORMAT_VERSION) {
    throw new BackupError('Questo file è stato creato da una versione più recente di Ricettacolo: aggiorna l\'app e riprova.')
  }

  const metas = new Map((body.photos ?? []).map((p) => [p.id, p]))
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, inboxAdded: 0, missingPhotos: 0 }
  const localRecipes = new Map((await db.listRecipes()).map((r) => [r.id, r]))

  const loadPhotos = async (ids: string[]): Promise<{ photos: { photo: PhotoRecord; thumb: ThumbRecord }[]; missing: number }> => {
    const photos: { photo: PhotoRecord; thumb: ThumbRecord }[] = []
    let missing = 0
    for (const id of ids) {
      if (await db.hasPhoto(id)) continue // le foto sono immutabili: se c'è già, non si tocca
      const bytes = entries[`foto/${id}.jpg`]
      if (!bytes) { missing++; continue }
      const blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' })
      const m = metas.get(id)
      photos.push({
        photo: {
          id, blob, mime: 'image/jpeg', width: m?.width ?? 0, height: m?.height ?? 0,
          sha256: await sha256Hex(bytes), createdAt: m?.createdAt ?? new Date().toISOString(),
        },
        thumb: { photoId: id, blob: await deps.makeThumb(blob) },
      })
    }
    return { photos, missing }
  }

  const usedCategories = new Set<string>(body.categories ?? [])
  for (const raw of body.recipes) {
    const incoming = migrateRecipe(raw)
    if (!incoming) { result.skipped++; continue }
    incoming.hash = await contentHash(incoming)
    incoming.categories.forEach((c) => usedCategories.add(c))
    const action = decideMerge(localRecipes.get(incoming.id), incoming)
    if (action === 'skip') { result.skipped++; continue }
    const { photos, missing } = await loadPhotos(incoming.photoIds)
    if (missing) result.missingPhotos++
    await db.putImportedRecipe(incoming, photos)
    result[action === 'add' ? 'added' : 'updated']++
  }
  await db.addCategories([...usedCategories])

  const knownInbox = new Set((await db.listInbox()).map((i) => i.id))
  for (const item of body.inbox ?? []) {
    if (!item?.id || !item.photoId || knownInbox.has(item.id)) continue
    const { photos } = await loadPhotos([item.photoId])
    if (!photos.length && !(await db.hasPhoto(item.photoId))) continue
    await db.putInboxItems([item], photos)
    result.inboxAdded++
  }
  return result
}

export function backupFileName(scope: 'tutto' | 'una', title?: string, now = new Date()): string {
  const d = now.toISOString().slice(0, 10)
  if (scope === 'una' && title) {
    const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    return `${slug || 'ricetta'}${EXTENSION}`
  }
  return `ricettacolo-${d}${EXTENSION}`
}
