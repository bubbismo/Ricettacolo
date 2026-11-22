import { listCategories, listInbox, listRecipes, getMeta } from '../adapters/storage/db'
import { backupReminderDue, getLastBackup, requestPersistence } from '../adapters/device/storage'
import { defaultFilters, searchRecipes, type Filters } from '../core/search'
import type { InboxItem, Recipe } from '../core/recipe'

export interface ShareDraft {
  link: string
  title: string
  source?: string
  mainIngredients?: string
  /** testo completo della ricetta (campo "Testo della ricetta") */
  text?: string
  notes: string
  notice?: { kind: 'ok' | 'warn'; text: string }
  /** indirizzo dell'immagine della pagina: solo anteprima, si salva solo su richiesta */
  imageUrl?: string
}

class Store {
  recipes = $state<Recipe[]>([])
  categories = $state<string[]>([])
  inbox = $state<InboxItem[]>([])
  loaded = $state(false)
  lastBackup = $state<string | undefined>(undefined)
  persisted = $state<boolean | undefined>(undefined)
  filters = $state<Filters>(defaultFilters())
  reminderDismissed = $state(false)
  /** dati arrivati dal tasto Condividi, in attesa di essere messi nel modulo "nuova ricetta" */
  shareDraft = $state<ShareDraft | null>(null)
  /** link arrivato dalla condivisione, in attesa che il servizio legga la ricetta */
  pendingImport = $state<{ link: string; title: string } | null>(null)

  get visible(): Recipe[] {
    return searchRecipes(this.recipes, this.filters)
  }
  get backupDue(): boolean {
    return !this.reminderDismissed && backupReminderDue(this.lastBackup, this.recipes.length)
  }
  byId(id: string): Recipe | undefined {
    return this.recipes.find((r) => r.id === id)
  }

  async load(): Promise<void> {
    const [recipes, categories, inbox, last, persisted] = await Promise.all([
      listRecipes(), listCategories(), listInbox(), getLastBackup(), getMeta<boolean>('persisted'),
    ])
    this.recipes = recipes
    this.inbox = inbox
    this.categories = categories
    this.lastBackup = last
    this.persisted = persisted
    this.loaded = true
  }

  async init(): Promise<void> {
    await this.load()
    this.persisted = await requestPersistence()
  }
}

export const store = new Store()
