<script lang="ts">
  import { onMount } from 'svelte'
  import { router } from '../app/router.svelte'
  import { store } from '../app/store.svelte'
  import { pwaUpdate } from '../app/pwaUpdate.svelte'
  import { handleShare } from '../app/share'
  import List from './screens/List.svelte'
  import View from './screens/View.svelte'
  import Edit from './screens/Edit.svelte'
  import Settings from './screens/Settings.svelte'
  import Inbox from './screens/Inbox.svelte'
  import Today from './screens/Today.svelte'
  import Cook from './screens/Cook.svelte'
  import Splash from './Splash.svelte'

  onMount(() => { void store.init().then(handleShare) })
  const r = $derived(router.route)
  const showTabs = $derived(r.name === 'list' || r.name === 'settings' || r.name === 'inbox' || r.name === 'today')
</script>

<Splash />

{#if pwaUpdate.ready}
  <div class="banner" style="position:sticky;top:0;z-index:70;margin:0;border-radius:0;text-align:center">
    È pronta una nuova versione.
    <button class="btn" style="min-height:36px;padding:4px 12px;margin-left:8px" onclick={() => pwaUpdate.apply()}>Aggiorna</button>
  </div>
{/if}

{#if r.name === 'list'}<List />
{:else if r.name === 'view'}{#key r.id}<View id={r.id} />{/key}
{:else if r.name === 'edit'}{#key r.id}<Edit id={r.id} />{/key}
{:else if r.name === 'inboxEdit'}{#key r.itemId}<Edit id={null} inboxId={r.itemId} />{/key}
{:else if r.name === 'cook'}{#key r.id}<Cook id={r.id} />{/key}
{:else if r.name === 'inbox'}<Inbox />
{:else if r.name === 'today'}<Today />
{:else if r.name === 'settings'}<Settings />
{/if}

{#if showTabs}
  <div class="tabbar">
    <nav aria-label="Sezioni">
      <a href="#/" aria-current={r.name === 'list' ? 'page' : undefined}><span>📖</span>Ricette</a>
      <a href="#/oggi" aria-current={r.name === 'today' ? 'page' : undefined}><span>🎲</span>Oggi</a>
      <a href="#/sistema" aria-current={r.name === 'inbox' ? 'page' : undefined}><span class="ico">📥{#if store.inbox.length}<b class="badge">{store.inbox.length}</b>{/if}</span>Da sistemare</a>
      <a href="#/impostazioni" aria-current={r.name === 'settings' ? 'page' : undefined}><span>⚙️</span>Impostazioni</a>
    </nav>
  </div>
{/if}
