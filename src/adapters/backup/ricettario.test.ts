import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildRicettario, importRicettario, BackupError } from './ricettario'
import * as db from '../storage/db'
import { emptyContent } from '../../core/recipe'

const deps = {
  makeThumb: async (b: Blob) => b,
  reduce: async (b: Blob) => ({ blob: b, width: 1, height: 1 }),
}

async function fakePhoto(label: string) {
  const id = crypto.randomUUID()
  const blob = new Blob([label], { type: 'image/jpeg' })
  return {
    photo: { id, blob, mime: 'image/jpeg', width: 10, height: 10, sha256: 'x', createdAt: new Date().toISOString() },
    thumb: { photoId: id, blob },
  }
}

async function wipe() {
  const d = await db.getDb()
  const tx = d.transaction(['recipes', 'photos', 'thumbs', 'inbox'], 'readwrite')
  await Promise.all(['recipes', 'photos', 'thumbs', 'inbox'].map((s) => tx.objectStore(s as 'recipes').clear()))
  await tx.done
}

describe('backup e importazione', () => {
  beforeEach(wipe)

  it('esporta e reimporta senza perdere nulla; il secondo import salta tutto', async () => {
    const p = await fakePhoto('pagina1')
    const r = await db.commitRecipe({
      content: { ...emptyContent(), title: 'Tiramisù', categories: ['Dolci', 'Nuova'], photoIds: [p.photo.id], rating: 5 },
      newPhotos: [p],
    })
    const file = await buildRicettario({ photoQuality: 'piena', deps })
    await wipe()
    const res = await importRicettario(file, deps)
    expect(res).toMatchObject({ added: 1, updated: 0, skipped: 0, missingPhotos: 0 })
    const back = await db.getRecipe(r.id)
    expect(back?.title).toBe('Tiramisù')
    expect(back?.hash).toBe(r.hash)
    expect(back?.updatedAt).toBe(r.updatedAt)
    expect(await db.hasPhoto(p.photo.id)).toBe(true)
    expect(await db.listCategories()).toContain('Nuova')
    expect(await importRicettario(file, deps)).toMatchObject({ added: 0, updated: 0, skipped: 1 })
  })

  it('non sovrascrive una copia locale più recente', async () => {
    const r = await db.commitRecipe({ content: { ...emptyContent(), title: 'Vecchio' } })
    const oldFile = await buildRicettario({ photoQuality: 'piena', deps })
    await new Promise((res) => setTimeout(res, 5))
    await db.commitRecipe({ id: r.id, content: { ...emptyContent(), title: 'Nuovo', date: r.date } })
    expect(await importRicettario(oldFile, deps)).toMatchObject({ updated: 0, skipped: 1 })
    expect((await db.getRecipe(r.id))?.title).toBe('Nuovo')
  })

  it('la ricetta si aggiorna dal file quando questo è più recente', async () => {
    const r = await db.commitRecipe({ content: { ...emptyContent(), title: 'A' } })
    const fileA = await buildRicettario({ photoQuality: 'piena', deps })
    // simulo un altro telefono: tolgo la ricetta e la ricreo più vecchia della copia nel file
    await wipe()
    const d = await db.getDb()
    await d.put('recipes', { ...r, title: 'Vecchia', hash: 'zzz', updatedAt: '2000-01-01T00:00:00.000Z' })
    expect(await importRicettario(fileA, deps)).toMatchObject({ updated: 1 })
    expect((await db.getRecipe(r.id))?.title).toBe('A')
  })

  it('rifiuta file non validi', async () => {
    await expect(importRicettario(new Blob(['ciao']), deps)).rejects.toBeInstanceOf(BackupError)
  })

  it('elimina le foto orfane quando si modifica o si cancella la ricetta', async () => {
    const p1 = await fakePhoto('1'), p2 = await fakePhoto('2')
    const r = await db.commitRecipe({ content: { ...emptyContent(), photoIds: [p1.photo.id] }, newPhotos: [p1] })
    await db.commitRecipe({ id: r.id, content: { ...emptyContent(), date: r.date, photoIds: [p2.photo.id] }, newPhotos: [p2] })
    expect(await db.hasPhoto(p1.photo.id)).toBe(false)
    expect(await db.hasPhoto(p2.photo.id)).toBe(true)
    await db.deleteRecipe(r.id)
    expect(await db.hasPhoto(p2.photo.id)).toBe(false)
  })
})
