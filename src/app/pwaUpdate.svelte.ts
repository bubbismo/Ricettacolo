/** Stato dell'aggiornamento dell'app: la nuova versione attende che sia l'utente ad accettarla. */
class PwaUpdate {
  ready = $state(false)
  apply: () => void = () => {}
}
export const pwaUpdate = new PwaUpdate()
