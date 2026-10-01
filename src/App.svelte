<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/stores/app.svelte';
  import { install } from './lib/stores/install.svelte';
  import { setTheme } from './lib/theme';
  import { t } from './lib/i18n/es';
  import TabBar, { type TabId } from './lib/components/TabBar.svelte';
  import Toast from './lib/components/Toast.svelte';
  import MortgageView from './lib/views/MortgageView.svelte';
  import ExpensesView from './lib/views/ExpensesView.svelte';
  import HistoryView from './lib/views/HistoryView.svelte';
  import SimulationView from './lib/views/SimulationView.svelte';
  import SettingsView from './lib/views/SettingsView.svelte';

  let tab = $state<TabId>('mortgage');
  let welcomeOpen = $state(false);

  onMount(() => {
    install.init();
    void app.init().then(() => {
      if (!app.settings.welcomeSeen) welcomeOpen = true;
    });
  });

  $effect(() => {
    setTheme(app.settings.theme);
  });

  async function closeWelcome() {
    welcomeOpen = false;
    await app.updateSettings({ welcomeSeen: true });
  }
</script>

<a class="skip-link" href="#main">Saltar al contenido</a>

<header class="topbar">
  <span class="brand-icon" aria-hidden="true">₭</span>
  <span class="brand-name">{t.app.name}</span>
  {#if install.available}
    <button class="btn btn-ghost small install-btn" onclick={() => install.prompt()}>
      <i class="fi fi-rr-download" aria-hidden="true"></i>
      {t.app.install}
    </button>
  {/if}
</header>

<main class="app-main" id="main">
  {#if app.ready}
    {#key tab}
      <div class="view-enter">
        {#if tab === 'mortgage'}
          <MortgageView />
        {:else if tab === 'expenses'}
          <ExpensesView />
        {:else if tab === 'history'}
          <HistoryView />
        {:else if tab === 'interest'}
          <SimulationView />
        {:else}
          <SettingsView onshowwelcome={() => (welcomeOpen = true)} />
        {/if}
      </div>
    {/key}
  {/if}
</main>

<TabBar active={tab} onselect={(to) => (tab = to)} />
<Toast />

{#if welcomeOpen}
  <div class="welcome-overlay">
    <div class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <span class="welcome-logo" aria-hidden="true">₭</span>
      <h2 id="welcome-title">{t.welcome.title}</h2>
      <p class="tagline">{t.app.tagline}</p>
      <ul>
        {#each t.welcome.features as f (f.title)}
          <li>
            <span class="f-icon" aria-hidden="true"><i class="fi {f.icon}"></i></span>
            <div>
              <strong>{f.title}</strong>
              <p>{f.text}</p>
            </div>
          </li>
        {/each}
      </ul>
      <button class="btn btn-primary cta" onclick={closeWelcome}>{t.welcome.start}</button>
    </div>
  </div>
{/if}

<style>
  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
    background: var(--accent);
    color: var(--accent-ink);
    padding: 8px 14px;
    border-radius: 0 0 8px 0;
    z-index: 500;
  }
  .skip-link:focus {
    left: 0;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 9px;
    max-width: 860px;
    margin: 0 auto;
    padding: max(14px, env(safe-area-inset-top)) 16px 0;
  }
  .brand-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-ink);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 800;
  }
  .brand-name {
    font-size: 17px;
    font-weight: 750;
    letter-spacing: -0.02em;
  }
  .install-btn {
    margin-left: auto;
  }

  .welcome-overlay {
    position: fixed;
    inset: 0;
    z-index: 350;
    background: rgb(20 18 14 / 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .welcome-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    max-width: 420px;
    width: 100%;
    max-height: 90dvh;
    overflow-y: auto;
    padding: 28px 24px 24px;
    text-align: center;
  }
  .welcome-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 26px;
    font-weight: 800;
    margin-bottom: 12px;
  }
  .welcome-card h2 {
    font-size: 21px;
    font-weight: 750;
    letter-spacing: -0.02em;
  }
  .tagline {
    color: var(--ink-soft);
    font-size: 13.5px;
    margin: 4px 0 20px;
  }
  .welcome-card ul {
    display: flex;
    flex-direction: column;
    gap: 15px;
    text-align: left;
    margin-bottom: 22px;
  }
  .welcome-card li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .f-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--surface);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    flex-shrink: 0;
  }
  .welcome-card strong {
    font-size: 14px;
  }
  .welcome-card li p {
    font-size: 13px;
    color: var(--ink-soft);
    line-height: 1.45;
    margin-top: 1px;
  }
  .cta {
    width: 100%;
  }
</style>
