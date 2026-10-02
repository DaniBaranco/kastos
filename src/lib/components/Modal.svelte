<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/es';

  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    children?: Snippet;
  }

  let { open, title, onclose, children }: Props = $props();

  let sheet = $state<HTMLElement | null>(null);
  let previouslyFocused: Element | null = null;

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      queueMicrotask(() => focusables()[0]?.focus());
      return () => {
        document.body.style.overflow = prevOverflow;
        (previouslyFocused as HTMLElement | null)?.focus?.();
      };
    }
  });

  // Se monta en <body> para que ningún ancestro con transform/animación
  // convierta el `position: fixed` en relativo a la vista.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function focusables(): HTMLElement[] {
    if (!sheet) return [];
    return Array.from(
      sheet.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
      return;
    }
    if (e.key !== 'Tab') return;
    // Focus trap
    const els = focusables();
    if (els.length === 0) return;
    const first = els[0]!;
    const last = els[els.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

{#if open}
  <div
    class="overlay"
    role="presentation"
    use:portal
    onclick={(e) => {
      if (e.target === e.currentTarget) onclose();
    }}
    onkeydown={onKeydown}
  >
    <div class="sheet" role="dialog" aria-modal="true" aria-label={title} bind:this={sheet}>
      <header class="sheet-head">
        <h2>{title}</h2>
        <button class="icon-btn" aria-label={t.actions.close} onclick={onclose}
          ><i class="fi fi-rr-cross-small" aria-hidden="true"></i></button
        >
      </header>
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(20 18 14 / 0.45);
    backdrop-filter: blur(3px);
    z-index: 300;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.18s var(--ease);
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .sheet {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius) var(--radius) 0 0;
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 560px;
    max-height: calc(100dvh - max(24px, env(safe-area-inset-top) + 12px));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
    animation: slideUp 0.24s var(--ease);
  }
  @keyframes slideUp {
    from {
      transform: translateY(28px);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .sheet-head h2 {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  @media (min-width: 700px) {
    .overlay {
      align-items: center;
      padding: 24px;
    }
    .sheet {
      border-radius: var(--radius);
    }
  }
</style>
