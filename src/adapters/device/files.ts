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

/**
 * Prova la condivisione di sistema (WhatsApp, Gmail, Drive…). Alcuni telefoni accettano solo estensioni note:
 * se `.ricettario` viene rifiutato si riprova con `.zip` e poi con `.txt` (l'importazione legge il contenuto, non il nome).
 * @returns 'shared' | 'downloaded' | 'cancelled'
 */
export async function deliver(blob: Blob, name: string, opts: { preferShare?: boolean } = {}): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (opts.preferShare && typeof navigator.share === 'function') {
    const candidates = [
      new File([blob], name, { type: 'application/zip' }),
      new File([blob], `${name}.zip`, { type: 'application/zip' }),
      // ultimo tentativo: Chrome su Android condivide solo tipi noti (testo, immagini, PDF…). Il contenuto resta identico
      // e l'importazione lo riconosce comunque, perché guarda dentro il file e non il nome.
      new File([blob], `${name}.txt`, { type: 'text/plain' }),
    ]
    const file = candidates.find((f) => canShareFiles(f))
    if (file) {
      try {
        await navigator.share({ files: [file], title: name })
        return 'shared'
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
        // altri errori (es. gesto utente scaduto): ripiega sul download
      }
    }
  }
  download(blob, name)
  return 'downloaded'
}
