import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb'
import { contentHash } from '../../core/hash'
import {
  DEFAULT_CATEGORIES, SCHEMA_VERSION, newId, normalizeRecipe,
  type CategoryRecord, type InboxItem, type PhotoRecord, type Recipe, type RecipeContent, type ThumbRecord,
} from '../../core/recipe'

interface Schema extends DBSchema {
  recipes: { key: string; value: Recipe }
  photos: { key: string; value: PhotoRecord }
  thumbs: { key: string; value: ThumbRecord }
  inbox: { key: string; value: InboxItem }
  categories: { key: string; value: CategoryRecord }
  meta: { key: string; value: { key: string; value: unknown } }
}

export const DB_NAME = 'ricettacolo'
export const DB_VERSION = 1

type Db = IDBPDatabase<Schema>
let dbPromise: Promise<Db> | null = null

/** Solo migrazioni additive: mai eliminare store o dati. */
export function getDb(): Promise<Db> {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _new, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('recipes', { keyPath: 'id' })
        db.createObjectStore('photos', { keyPath: 'id' })
        db.createObjectStore('thumbs', { keyPath: 'photoId' })
        db.createObjectStore('inbox', { keyPath: 'id' })
        const cats = db.createObjectStore('categories', { keyPath: 'name' })
        DEFAULT_CATEGORIES.forEach((name, order) => void cats.put({ name, order }))
        db.createObjectStore('meta', { keyPath: 'key' })
        void tx
      }
    },
  })
  return dbPromise
}

type Tx = IDBPTransaction<Schema, StoreNames<Schema>[], 'readwrite'>
const ALL: StoreNames<Schema>[] = ['recipes', 'photos', 'thumbs', 'inbox', 'categories', 'meta']

/** Elimina le foto non più usate da nessuna ricetta né dalla cassetta "Da sistemare". */
async function gcPhotos(tx: Tx, candidates: Iterable<string>): Promise<void> {
  const ids = new Set(candidates)
  if (!ids.size) return
  for (const r of await tx.objectStore('recipes').getAll()) r.photoIds.forEach((p) => ids.delete(p))
  for (const i of await tx.objectStore('inbox').getAll()) ids.delete(i.photoId)
  for (const id of ids) {
    await tx.objectStore('photos').delete(id)
    await tx.objectStore('thumbs').delete(id)
  }
}

// ---------- ricette ----------

export async function listRecipes(): Promise<Recipe[]> {
  const rows = await (await getDb()).getAll('recipes')
  return rows.map((r) => normalizeRecipe(r))
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const r = await (await getDb()).get('recipes', id)
  return r ? normalizeRecipe(r) : undefined
}

export interface NewPhoto { photo: PhotoRecord; thumb: ThumbRecord }

/**
 * Crea o modifica una ricetta insieme alle sue nuove foto, in un'unica transazione:
 * o si salva tutto o non cambia niente. Ricalcola hash e data di modifica.
 */
export async function commitRecipe(opts: {
  id?: string
  content: RecipeContent
  newPhotos?: NewPhoto[]
  /** foto della cassetta consumate da questa ricetta */
  consumeInbox?: string[]
}): Promise<Recipe> {
  const db = await getDb()
  const hash = await contentHash(opts.content)
  const now = new Date().toISOString()
  const tx = db.transaction(ALL, 'readwrite')
  const existing = opts.id ? await tx.objectStore('recipes').get(opts.id) : undefined
  const recipe: Recipe = {
    ...opts.content,
    id: existing?.id ?? opts.id ?? newId(),
    schemaVersion: SCHEMA_VERSION,
    hash,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  for (const { photo, thumb } of opts.newPhotos ?? []) {
    await tx.objectStore('photos').put(photo)
    await tx.objectStore('thumbs').put(thumb)
  }
  await tx.objectStore('recipes').put(recipe)
  for (const id of opts.consumeInbox ?? []) await tx.objectStore('inbox').delete(id)
  await gcPhotos(tx, existing?.photoIds ?? [])
  await tx.done
  return recipe
}


export async function deleteRecipe(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(ALL, 'readwrite')
  const r = await tx.objectStore('recipes').get(id)
  if (!r) return
  await tx.objectStore('recipes').delete(id)
  await gcPhotos(tx, r.photoIds)
  await tx.done
}

/** Usata dall'importazione: scrive una ricetta già completa (id, hash e date originali) con le sue foto. */
export async function putImportedRecipe(recipe: Recipe, photos: NewPhoto[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(ALL, 'readwrite')
  const old = await tx.objectStore('recipes').get(recipe.id)
  for (const { photo, thumb } of photos) {
    await tx.objectStore('photos').put(photo)
    await tx.objectStore('thumbs').put(thumb)
  }
  await tx.objectStore('recipes').put(recipe)
  await gcPhotos(tx, old?.photoIds ?? [])
  await tx.done
}

// ---------- foto ----------

export async function hasPhoto(id: string): Promise<boolean> {
  return (await (await getDb()).getKey('photos', id)) !== undefined
}
export async function getPhoto(id: string): Promise<PhotoRecord | undefined> {
  return (await getDb()).get('photos', id)
}
export async function getThumb(id: string): Promise<Blob | undefined> {
  return (await (await getDb()).get('thumbs', id))?.blob
}

// ---------- cassetta "Da sistemare" ----------

export async function listInbox(): Promise<InboxItem[]> {
  return (await (await getDb()).getAll('inbox')).sort((a, b) => a.addedAt.localeCompare(b.addedAt))
}
export async function putInboxItems(items: InboxItem[], photos: NewPhoto[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(ALL, 'readwrite')
  for (const { photo, thumb } of photos) {
    await tx.objectStore('photos').put(photo)
    await tx.objectStore('thumbs').put(thumb)
  }
  for (const i of items) await tx.objectStore('inbox').put(i)
  await tx.done
}

// ---------- categorie ----------

export async function listCategories(): Promise<string[]> {
  return (await (await getDb()).getAll('categories')).sort((a, b) => a.order - b.order).map((c) => c.name)
}

async function writeCategories(names: string[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('categories', 'readwrite')
  await tx.store.clear()
  names.forEach((name, order) => void tx.store.put({ name, order }))
  await tx.done
}

export async function addCategories(names: string[]): Promise<void> {
  const cur = await listCategories()
  const set = new Set(cur.map((c) => c.toLowerCase()))
  const add = names.map((n) => n.trim()).filter((n) => n && !set.has(n.toLowerCase()))
  if (add.length) await writeCategories([...cur, ...new Set(add)])
}

export async function reorderCategories(names: string[]): Promise<void> {
  await writeCategories(names)
}

/** Rinomina (o, con newName null, elimina) una categoria anche nelle ricette che la usano. */
export async function renameCategory(oldName: string, newName: string | null): Promise<number> {
  const target = newName?.trim() || null
  const cur = await listCategories()
  const recipes = (await listRecipes()).filter((r) => r.categories.includes(oldName))
  const updated = await Promise.all(recipes.map(async (r) => {
    const cats = [...new Set(r.categories.flatMap((c) => (c === oldName ? (target ? [target] : []) : [c])))]
    const next = { ...r, categories: cats }
    return { ...next, hash: await contentHash(next), updatedAt: new Date().toISOString() }
  }))
  const db = await getDb()
  const tx = db.transaction(['recipes', 'categories'], 'readwrite')
  for (const r of updated) await tx.objectStore('recipes').put(r)
  await tx.done
  const names = cur.flatMap((c) => (c === oldName ? (target ? [target] : []) : [c]))
  await writeCategories([...new Set(names)])
  return updated.length
}

// ---------- meta ----------

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('meta', key))?.value as T | undefined
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', { key, value })
}

// ---------- lettura per l'esportazione ----------

export async function readForExport(ids?: string[]): Promise<{
  recipes: Recipe[]
  photos: PhotoRecord[]
  inbox: InboxItem[]
  categories: string[]
}> {
  const db = await getDb()
  const all = await listRecipes()
  const recipes = ids ? all.filter((r) => ids.includes(r.id)) : all
  const inbox = ids ? [] : await listInbox()
  const photoIds = new Set([...recipes.flatMap((r) => r.photoIds), ...inbox.map((i) => i.photoId)])
  const photos: PhotoRecord[] = []
  for (const id of photoIds) {
    const p = await db.get('photos', id)
    if (p) photos.push(p)
  }
  return { recipes, photos, inbox, categories: await listCategories() }
}
