<script lang="ts">
  import { splashEnabled } from '../app/splash'
  import { tick } from '../adapters/device/haptics'

  // se si arriva dal tasto Condividi si va dritti al lavoro, senza schermata iniziale
  let visible = $state(splashEnabled() && new URLSearchParams(location.search).get('share') !== '1')
  let leaving = $state(false)
  const icon = `${import.meta.env.BASE_URL}favicon.svg`

  function enter() {
    if (leaving) return
    leaving = true
    tick(15)
    setTimeout(() => (visible = false), 600)
  }
</script>

{#if visible}
  <div id="splash" class:leaving>
    <button class="logo" aria-label="Entra in Ricettacolo" onclick={enter}>
      <img src={icon} alt="" width="280" height="280" draggable="false" />
    </button>
    <h1>Ricettacolo</h1>
    <p class="brand">LilliLab</p>
  </div>
{/if}

<style>
  #splash { position: fixed; inset: 0; z-index: 200; background: #fbf1df; color: #5a2a14; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 3vh; transition: opacity .5s ease; }
  #splash.leaving { opacity: 0; pointer-events: none; }
  .logo { background: none; border: 0; padding: 0; width: min(62vw, 300px); aspect-ratio: 1; cursor: pointer;
    animation: pop-in .7s cubic-bezier(.2, .9, .3, 1.15) both, beat 2.4s ease-in-out .7s infinite; }
  .logo:focus-visible { outline: 3px solid #c8322a; outline-offset: 6px; border-radius: 24px; }
  img { width: 100%; height: 100%; display: block; -webkit-user-drag: none; }
  h1 { margin: 0; font-size: clamp(34px, 10.5vw, 60px); font-weight: 900; letter-spacing: .03em; animation: rise-in .6s ease-out .25s both; }
  .brand { margin: -1vh 0 0; font-size: 14px; letter-spacing: .12em; color: #a08a78; font-weight: 600; animation: rise-in .6s ease-out .4s both; }
  @keyframes pop-in { from { opacity: 0; transform: scale(.82); } }
  @keyframes rise-in { from { opacity: 0; transform: translateY(14px); } }
  @keyframes beat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
  @media (prefers-reduced-motion: reduce) { .logo, h1, .brand { animation: none; } }
</style>
