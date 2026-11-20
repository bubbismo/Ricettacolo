import { getMeta, setMeta } from '../storage/db'

export const BACKUP_REMINDER_DAYS = 30

/** Chiede al browser di non cancellare i dati (su iOS può farlo senza avviso). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    const already = await navigator.storage.persisted?.()
    const ok = already || (await navigator.storage.persist())
    await setMeta('persisted', ok)
    return ok
  } catch {
    return false
  }
}

export async function storageUsage(): Promise<{ used: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    return e && e.usage != null ? { used: e.usage, quota: e.quota ?? 0 } : null
  } catch {
    return null
  }
}

export const getLastBackup = () => getMeta<string>('lastBackupAt')
export const markBackupDone = () => setMeta('lastBackupAt', new Date().toISOString())

/** Il promemoria serve se c'è almeno una ricetta e l'ultimo backup è assente o vecchio. */
export function backupReminderDue(lastBackupAt: string | undefined, recipeCount: number, now = Date.now()): boolean {
  if (recipeCount === 0) return false
  if (!lastBackupAt) return true
  return now - Date.parse(lastBackupAt) > BACKUP_REMINDER_DAYS * 86_400_000
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
