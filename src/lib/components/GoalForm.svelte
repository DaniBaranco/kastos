<script lang="ts">
  import Modal from './Modal.svelte';
  import AmountField from './AmountField.svelte';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { parseAmountToCents } from '../core/money';
  import { todayISO } from '../core/dates';
  import type { SavingsGoal } from '../core/types';

  interface Props {
    open: boolean;
    goal?: SavingsGoal | null;
    onclose: () => void;
  }

  let { open, goal = null, onclose }: Props = $props();

  let name = $state('');
  let emoji = $state('🎯');
  let target = $state('');
  let deadline = $state('');
  let error = $state('');

  $effect(() => {
    if (!open) return;
    error = '';
    if (goal) {
      name = goal.name;
      emoji = goal.emoji;
      target = (goal.targetCents / 100).toFixed(2).replace('.', ',');
      deadline = goal.deadline;
    } else {
      name = '';
      emoji = '🎯';
      target = '';
      deadline = '';
    }
  });

  async function save() {
    const cents = parseAmountToCents(target);
    if (name.trim() === '') return (error = t.forms.errors.name);
    if (cents === null || cents <= 0) return (error = t.forms.errors.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return (error = t.forms.errors.date);
    // En creación exigimos plazo futuro; al editar se permite (histórico).
    if (!goal && deadline <= todayISO()) return (error = t.forms.errors.deadlineFuture);
    error = '';
    await app.saveGoal({
      id: goal?.id ?? crypto.randomUUID(),
      name: name.trim(),
      emoji: emoji.trim() === '' ? '🎯' : emoji.trim(),
      targetCents: cents,
      deadline,
      archived: goal?.archived ?? false,
    });
    toast.show(t.toasts.saved);
    onclose();
  }

  async function remove() {
    if (!goal) return;
    if (!confirm(t.confirm.deleteGoal)) return;
    await app.deleteGoal(goal.id);
    toast.show(t.toasts.deleted);
    onclose();
  }
</script>

<Modal {open} title={goal ? t.forms.goal.editTitle : t.forms.goal.newTitle} {onclose}>
  <div class="field-row emoji-name">
    <div class="field">
      <label for="goal-emoji">{t.forms.emoji}</label>
      <input id="goal-emoji" class="input emoji" type="text" maxlength="4" bind:value={emoji} />
    </div>
    <div class="field">
      <label for="goal-name">{t.forms.goalName}</label>
      <input
        id="goal-name"
        class="input"
        type="text"
        maxlength="50"
        placeholder={t.forms.goalNamePh}
        bind:value={name}
      />
    </div>
  </div>

  <AmountField id="goal-target" label={t.forms.target} bind:value={target} />

  <div class="field">
    <label for="goal-deadline">{t.forms.deadline}</label>
    <input id="goal-deadline" class="input" type="date" bind:value={deadline} />
  </div>

  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if goal}
      <button class="btn btn-danger" onclick={remove}>{t.actions.delete}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn btn-ghost" onclick={onclose}>{t.actions.cancel}</button>
    <button class="btn btn-primary" onclick={save}>{t.actions.save}</button>
  </div>
</Modal>

<style>
  .emoji-name {
    grid-template-columns: 84px 1fr;
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
