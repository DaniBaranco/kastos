<script lang="ts">
  import Modal from './Modal.svelte';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import type { ExpenseCategory } from '../core/types';

  interface Props {
    open: boolean;
    category?: ExpenseCategory | null;
    onclose: () => void;
  }

  let { open, category = null, onclose }: Props = $props();

  let name = $state('');
  let emoji = $state('📦');
  let archived = $state(false);
  let error = $state('');

  $effect(() => {
    if (!open) return;
    error = '';
    name = category?.name ?? '';
    emoji = category?.emoji ?? '📦';
    archived = category?.archived ?? false;
  });

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return (error = t.forms.errors.name);
    error = '';
    await app.saveCategory({
      id: category?.id ?? crypto.randomUUID(),
      name: trimmed,
      emoji: emoji.trim() || '📦',
      archived,
    });
    toast.show(t.toasts.saved);
    onclose();
  }

  async function remove() {
    if (!category || !confirm(t.confirm.deleteCategory)) return;
    const result = await app.deleteCategory(category.id);
    toast.show(result === 'archived' ? t.settings.categoryArchived : t.toasts.deleted);
    onclose();
  }
</script>

<Modal
  {open}
  title={category ? t.forms.categoryForm.editTitle : t.forms.categoryForm.newTitle}
  {onclose}
>
  <div class="field-row cat-row">
    <div class="field">
      <label for="cat-emoji">{t.forms.emoji}</label>
      <input id="cat-emoji" class="input emoji" type="text" maxlength="4" bind:value={emoji} />
    </div>
    <div class="field">
      <label for="cat-name">{t.forms.categoryName}</label>
      <input
        id="cat-name"
        class="input"
        type="text"
        maxlength="30"
        placeholder={t.forms.categoryNamePh}
        bind:value={name}
      />
    </div>
  </div>

  {#if category}
    <label class="check-row">
      <input type="checkbox" bind:checked={archived} />
      <span>{t.forms.archived}</span>
    </label>
  {/if}

  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if category}
      <button class="btn btn-danger" onclick={remove}>{t.actions.delete}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn btn-ghost" onclick={onclose}>{t.actions.cancel}</button>
    <button class="btn btn-primary" onclick={save}>{t.actions.save}</button>
  </div>
</Modal>

<style>
  .cat-row {
    grid-template-columns: 76px 1fr;
  }
  .emoji {
    text-align: center;
    font-size: 20px;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 18px;
  }
  .spacer {
    flex: 1;
  }
</style>
