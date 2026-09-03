<script module lang="ts">
  export type TabId = 'home' | 'simulation' | 'goals' | 'settings';
</script>

<script lang="ts">
  import { t } from '../i18n/es';

  interface Props {
    active: TabId;
    onselect: (tab: TabId) => void;
  }

  let { active, onselect }: Props = $props();

  // Iconos: Flaticon UIcons (regular rounded).
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'home', label: t.tabs.home, icon: 'fi-rr-piggy-bank' },
    { id: 'simulation', label: t.tabs.simulation, icon: 'fi-rr-chart-line-up' },
    { id: 'goals', label: t.tabs.goals, icon: 'fi-rr-target' },
    { id: 'settings', label: t.tabs.settings, icon: 'fi-rr-settings' },
  ];
</script>

<nav aria-label="Navegación principal">
  {#each tabs as tab (tab.id)}
    <button
      class:active={active === tab.id}
      aria-current={active === tab.id ? 'page' : undefined}
      onclick={() => onselect(tab.id)}
    >
      <i class="fi {tab.icon}" aria-hidden="true"></i>
      <span>{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    justify-content: space-around;
    background: color-mix(in srgb, var(--bg) 90%, transparent);
    backdrop-filter: blur(14px) saturate(160%);
    -webkit-backdrop-filter: blur(14px) saturate(160%);
    border-top: 1px solid var(--border);
    padding: 7px 4px calc(7px + env(safe-area-inset-bottom));
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 62px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    color: var(--ink-faint);
    font-size: 10.5px;
    font-weight: 650;
    transition:
      color 0.18s var(--ease),
      background 0.18s var(--ease);
  }
  button:hover {
    color: var(--ink-soft);
  }
  button.active {
    color: var(--ink);
    background: var(--surface);
  }
  button i.fi {
    font-size: 18px;
  }
  @media (min-width: 700px) {
    nav {
      max-width: 880px;
      margin: 0 auto;
      border: 1px solid var(--border);
      border-bottom: none;
      border-radius: var(--radius) var(--radius) 0 0;
    }
  }
</style>
