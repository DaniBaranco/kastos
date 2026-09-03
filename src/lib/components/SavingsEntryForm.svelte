<script lang="ts">
  import Modal from './Modal.svelte';
  import AmountField from './AmountField.svelte';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { parseAmountToCents } from '../core/money';
  import { currentMonthKey } from '../core/dates';
  import type { SavingsEntry } from '../core/types';

  interface Props {
    open: boolean;
    entry?: SavingsEntry | null;
    /** Preseleccionar objetivo (al aportar desde la vista Objetivos). */
    goalId?: string;
    /** Abrir con "punto de partida" premarcado (bolsa que el usuario ya tenía). */
    startAsInitial?: boolean;
    onclose: () => void;
  }

  let { open, entry = null, goalId, startAsInitial = false, onclose }: Props = $props();

  let amount = $state('');
  let month = $state(currentMonthKey());
  let selectedGoal = $state('');
  let isInitial = $state(false);
  let note = $state('');
  let error = $state('');

  $effect(() => {
    if (!open) return;
    error = '';
    if (entry) {
      amount = (entry.amountCents / 100).toFixed(2).replace('.', ',');
      month = entry.month;
      selectedGoal = entry.goalId ?? '';
      isInitial = entry.initial === true;
      note = entry.note ?? '';
    } else {
      amount = '';
      month = currentMonthKey();
      selectedGoal = goalId ?? '';
      isInitial = startAsInitial;
      note = '';
    }
  });

  const activeGoals = $derived(app.goals.filter((g) => !g.archived));

  async function save() {
    const cents = parseAmountToCents(amount);
    if (cents === null || cents === 0) return (error = t.forms.errors.amountAny);
    if (!/^\d{4}-\d{2}$/.test(month)) return (error = t.forms.errors.date);
    error = '';
    await app.saveEntry({
      id: entry?.id ?? crypto.randomUUID(),
      month,
      amountCents: cents,
      initial: isInitial ? true : undefined,
      goalId: selectedGoal === '' ? undefined : selectedGoal,
      note: note.trim() === '' ? undefined : note.trim(),
      createdAt: entry?.createdAt ?? new Date().toISOString(),
    });
    toast.show(t.toasts.saved);
    onclose();
  }

  async function remove() {
    if (!entry) return;
    if (!confirm(t.confirm.deleteEntry)) return;
    await app.deleteEntry(entry.id);
    toast.show(t.toasts.deleted);
    onclose();
  }
</script>

<Modal
  {open}
  title={entry ? t.forms.savingEntry.editTitle : t.forms.savingEntry.newTitle}
  {onclose}
>
  <AmountField
    id="sav-amount"
    label={t.forms.amount}
    bind:value={amount}
    hint={t.forms.savingAmountHint}
  />

  <div class="field-row">
    <div class="field">
      <label for="sav-month">{t.forms.month}</label>
      <input id="sav-month" class="input" type="month" bind:value={month} />
    </div>
    <div class="field">
      <label for="sav-goal">{t.forms.goalOptional}</label>
      <select id="sav-goal" class="select" bind:value={selectedGoal}>
        <option value="">{t.forms.noGoal}</option>
        {#each activeGoals as g (g.id)}
          <option value={g.id}>{g.emoji} {g.name}</option>
        {/each}
      </select>
    </div>
  </div>

  <label class="check-row">
    <input type="checkbox" bind:checked={isInitial} />
    <span>{t.forms.savingInitial}</span>
  </label>
  {#if isInitial}
    <p class="initial-hint">
      <i class="fi fi-rr-bank" aria-hidden="true"></i>
      {t.forms.savingInitialHint}
    </p>
  {/if}

  <div class="field">
    <label for="sav-note">{t.forms.note}</label>
    <input id="sav-note" class="input" type="text" maxlength="120" bind:value={note} />
  </div>

  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if entry}
      <button class="btn btn-danger" onclick={remove}>{t.actions.delete}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn btn-ghost" onclick={onclose}>{t.actions.cancel}</button>
    <button class="btn btn-primary" onclick={save}>{t.actions.save}</button>
  </div>
</Modal>

<style>
  .initial-hint {
    font-size: 12.5px;
    color: var(--ink-soft);
    margin: -4px 0 10px;
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
