<script lang="ts">
  import { toast } from '../stores/toast.svelte';
</script>

{#if toast.message}
  <div class="toast {toast.kind === 'err' ? 'err' : ''}" role="status" aria-live="polite">
    {toast.message}
  </div>
{/if}
