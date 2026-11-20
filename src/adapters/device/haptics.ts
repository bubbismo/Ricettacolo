/** Un leggero "tic" al tocco, dove il telefono lo permette (Android). Altrove non fa nulla. */
export function tick(ms = 12): void {
  try { navigator.vibrate?.(ms) } catch { /* non supportato */ }
}
