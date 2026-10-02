<script lang="ts">
  import { toast } from '../stores/toast.svelte';
</script>

{#if toast.message}
  <div class="toast {toast.kind === 'err' ? 'err' : ''}" role="status" aria-live="polite">
    <span>{toast.message}</span>
    {#if toast.action}
      <button class="toast-action" onclick={() => toast.runAction()}>{toast.action.label}</button>
    {/if}
  </div>
{/if}

<style>
  .toast {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    width: max-content;
  }
  .toast-action {
    flex-shrink: 0;
    white-space: nowrap;
    color: inherit;
    font: inherit;
    font-weight: 750;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
