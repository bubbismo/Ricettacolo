<script lang="ts">
  import { splashEnabled } from '../app/splash'

  let visible = $state(splashEnabled())
  let leaving = $state(false)
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const icon = `${import.meta.env.BASE_URL}favicon.svg`

  function enter() {
    if (leaving) return
    leaving = true
    setTimeout(() => (visible = false), reduce ? 200 : 520)
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
    align-items: center; justify-content: center; gap: 3vh; transition: opacity .45s ease; }
  #splash.leaving { opacity: 0; }
  .logo { background: none; border: 0; padding: 0; width: min(62vw, 300px); aspect-ratio: 1; cursor: pointer;
    animation: beat 1.8s ease-in-out infinite; transition: transform .5s ease-in; }
  #splash.leaving .logo { animation: none; transform: scale(1.25); }
  .logo:focus-visible { outline: 3px solid #c8322a; outline-offset: 6px; border-radius: 24px; }
  img { width: 100%; height: 100%; display: block; -webkit-user-drag: none; }
  h1 { margin: 0; font-size: clamp(34px, 10.5vw, 60px); font-weight: 900; letter-spacing: .03em; }
  .brand { margin: -1vh 0 0; font-size: 14px; letter-spacing: .12em; color: #a08a78; font-weight: 600; }
  @keyframes beat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
  @media (prefers-reduced-motion: reduce) { .logo { animation: none; transition: none; } #splash.leaving .logo { transform: none; } }
</style>
