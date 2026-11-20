/** Consegna un file all'utente: condivisione di sistema se c'è, altrimenti download. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function canShareFiles(file: File): boolean {
  return typeof navigator.canShare === 'function' && typeof navigator.share === 'function' && navigator.canShare({ files: [file] })
}

/** @returns 'shared' | 'downloaded' | 'cancelled' */
export async function deliver(blob: Blob, name: string, opts: { preferShare?: boolean } = {}): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })
  if (opts.preferShare && canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // altri errori (es. gesto utente scaduto): ripiega sul download
    }
  }
  download(blob, name)
  return 'downloaded'
}
