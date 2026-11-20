import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import { pwaUpdate } from './app/pwaUpdate.svelte'
import './ui/theme.css'
import App from './ui/App.svelte'

// Una nuova versione non ricarica mai la pagina da sola: prima si chiede, così non si perde una modifica in corso.
const updateSW = registerSW({
  onNeedRefresh() {
    pwaUpdate.apply = () => void updateSW(true)
    pwaUpdate.ready = true
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => void registration.update(), 3600 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update()
    })
  },
})

export default mount(App, { target: document.getElementById('app')! })
