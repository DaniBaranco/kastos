<script lang="ts">
  import Modal from './Modal.svelte';
  import AmountField from './AmountField.svelte';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { parseAmountToCents } from '../core/money';
  import type { Expense } from '../core/types';

  interface Props {
    open: boolean;
    expense?: Expense | null;
    defaultMonth: string;
    onclose: () => void;
  }

  let { open, expense = null, defaultMonth, onclose }: Props = $props();

  let amount = $state('');
  let month = $state('');
  let categoryId = $state('');
  let note = $state('');
  let error = $state('');

  // Archivadas fuera, salvo la del gasto que se edita.
  const options = $derived(
    app.categories.filter((c) => !c.archived || c.id === expense?.categoryId),
  );

  $effect(() => {
    if (!open) return;
    error = '';
    if (expense) {
      amount = (expense.amountCents / 100).toFixed(2).replace('.', ',');
      month = expense.month;
      categoryId = expense.categoryId;
      note = expense.note ?? '';
    } else {
      amount = '';
      month = defaultMonth;
      categoryId = '';
      note = '';
    }
  });

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) return (error = t.forms.errors.amount);
    if (!/^\d{4}-\d{2}$/.test(month)) return (error = t.forms.errors.month);
    if (!app.categoryById.has(categoryId)) return (error = t.forms.errors.category);
    error = '';
    const trimmed = note.trim();
    await app.saveExpense({
      id: expense?.id ?? crypto.randomUUID(),
      month,
      categoryId,
      amountCents: cents,
      ...(trimmed ? { note: trimmed } : {}),
      createdAt: expense?.createdAt ?? new Date().toISOString(),
    });
    toast.show(t.toasts.saved);
    onclose();
  }

  async function remove() {
    if (!expense || !confirm(t.confirm.deleteExpense)) return;
    await app.deleteExpense(expense.id);
    toast.show(t.toasts.deleted);
    onclose();
  }
</script>

<Modal {open} title={expense ? t.forms.expense.editTitle : t.forms.expense.newTitle} {onclose}>
  <AmountField id="exp-amount" label={t.forms.amount} bind:value={amount} />

  <div class="field">
    <span class="label" id="exp-cat-label">{t.forms.category}</span>
    <div class="cat-grid" role="radiogroup" aria-labelledby="exp-cat-label">
      {#each options as c (c.id)}
        <button
          type="button"
          class="cat"
          role="radio"
          aria-checked={categoryId === c.id}
          onclick={() => (categoryId = c.id)}
        >
          <span aria-hidden="true">{c.emoji}</span>
          <span class="cat-name">{c.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="field">
    <label for="exp-month">{t.forms.month}</label>
    <input id="exp-month" class="input" type="month" bind:value={month} />
  </div>

  <div class="field">
    <label for="exp-note">{t.forms.note}</label>
    <input
      id="exp-note"
      class="input"
      type="text"
      maxlength="80"
      placeholder={t.forms.notePh}
      bind:value={note}
    />
  </div>

  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if expense}
      <button class="btn btn-danger" onclick={remove}>{t.actions.delete}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn btn-ghost" onclick={onclose}>{t.actions.cancel}</button>
    <button class="btn btn-primary" onclick={save}>{t.actions.save}</button>
  </div>
</Modal>

<style>
  .label {
    font-size: 13px;
    font-weight: 650;
    color: var(--ink-soft);
  }
  .cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 6px;
  }
  .cat {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg);
    border: 1.5px solid transparent;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    min-width: 0;
  }
  .cat[aria-checked='true'] {
    border-color: var(--accent);
    background: var(--surface-2);
  }
  .cat-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
