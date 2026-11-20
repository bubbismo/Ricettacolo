import { listCategories, listRecipes, getMeta } from '../adapters/storage/db'
import { backupReminderDue, getLastBackup, requestPersistence } from '../adapters/device/storage'
import { defaultFilters, searchRecipes, type Filters } from '../core/search'
import type { Recipe } from '../core/recipe'

class Store {
  recipes = $state<Recipe[]>([])
  categories = $state<string[]>([])
  loaded = $state(false)
  lastBackup = $state<string | undefined>(undefined)
  persisted = $state<boolean | undefined>(undefined)
  filters = $state<Filters>(defaultFilters())
  reminderDismissed = $state(false)

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
    const [recipes, categories, last, persisted] = await Promise.all([
      listRecipes(), listCategories(), getLastBackup(), getMeta<boolean>('persisted'),
    ])
    this.recipes = recipes
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
