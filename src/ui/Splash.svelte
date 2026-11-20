<script lang="ts">
  import { splashEnabled } from '../app/splash'
  import { tick } from '../adapters/device/haptics'
  import Steam from './components/Steam.svelte'

  let visible = $state(splashEnabled())
  let leaving = $state(false)
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const icon = `${import.meta.env.BASE_URL}favicon.svg`

  function enter() {
    if (leaving) return
    leaving = true
    tick(15)
    setTimeout(() => (visible = false), reduce ? 250 : 1350)
  }
</script>

{#if visible}
  <div id="splash" class:leaving>
    <div class="bg"></div>
    <div class="content">
      <div class="stage">
        <button class="logo" aria-label="Entra in Ricettacolo" onclick={enter}>
          <img src={icon} alt="" width="280" height="280" draggable="false" />
        </button>
        <Steam size={300} />
      </div>
      <h1>Ricettacolo</h1>
      <p class="brand">LilliLab</p>
    </div>
    {#if leaving}<Steam mode="burst" />{/if}
  </div>
{/if}

<style>
  #splash { position: fixed; inset: 0; z-index: 200; color: #5a2a14; }
  #splash.leaving { pointer-events: none; }
  .bg { position: absolute; inset: 0; background: #fbf1df; transition: opacity .55s ease .4s; }
  .leaving .bg { opacity: 0; }
  .content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3vh;
    transition: opacity .45s ease .25s, transform .7s ease-in; }
  .leaving .content { opacity: 0; transform: translate3d(0, -3vh, 0); }
  .stage { position: relative; width: min(62vw, 300px); aspect-ratio: 1; }
  .logo { background: none; border: 0; padding: 0; width: 100%; height: 100%; cursor: pointer; position: relative; z-index: 1;
    animation: pop-in .7s cubic-bezier(.2, .9, .3, 1.15) both, beat 2.4s ease-in-out .7s infinite; }
  .logo:focus-visible { outline: 3px solid #c8322a; outline-offset: 6px; border-radius: 24px; }
  img { width: 100%; height: 100%; display: block; -webkit-user-drag: none; }
  h1 { margin: 0; font-size: clamp(34px, 10.5vw, 60px); font-weight: 900; letter-spacing: .03em; animation: rise-in .6s ease-out .25s both; }
  .brand { margin: -1vh 0 0; font-size: 14px; letter-spacing: .12em; color: #a08a78; font-weight: 600; animation: rise-in .6s ease-out .4s both; }
  .stage :global(.steam) { z-index: 2; }
  @keyframes pop-in { from { opacity: 0; transform: scale(.82); } }
  @keyframes rise-in { from { opacity: 0; transform: translateY(14px); } }
  @keyframes beat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
  @media (prefers-reduced-motion: reduce) {
    .logo, h1, .brand { animation: none; }
    .leaving .content { transform: none; }
  }
</style>
