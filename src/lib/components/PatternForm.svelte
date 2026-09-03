<script lang="ts">
  import Modal from './Modal.svelte';
  import AmountField from './AmountField.svelte';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { parseAmountToCents } from '../core/money';
  import type { SavingsPattern } from '../core/types';

  interface Props {
    open: boolean;
    pattern?: SavingsPattern | null;
    /** Valores para precargar al crear (p. ej. desde la calculadora). */
    preset?: { monthlyCents: number; annualRatePct: number } | null;
    onclose: () => void;
  }

  let { open, pattern = null, preset = null, onclose }: Props = $props();

  let name = $state('');
  let emoji = $state('📐');
  let monthly = $state('');
  let rate = $state(0);
  let active = $state(true);
  let error = $state('');

  $effect(() => {
    if (!open) return;
    error = '';
    if (pattern) {
      name = pattern.name;
      emoji = pattern.emoji;
      monthly = (pattern.monthlyCents / 100).toFixed(2).replace('.', ',');
      rate = pattern.annualRatePct;
      active = pattern.active;
    } else {
      name = '';
      emoji = '📐';
      monthly = preset ? (preset.monthlyCents / 100).toFixed(2).replace('.', ',') : '';
      rate = preset ? preset.annualRatePct : 0;
      // El primer patrón se activa por defecto; los siguientes no.
      active = app.patterns.length === 0;
    }
  });

  async function save() {
    const cents = parseAmountToCents(monthly);
    if (name.trim() === '') return (error = t.forms.errors.name);
    if (cents === null || cents <= 0) return (error = t.forms.errors.amount);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return (error = t.forms.errors.rate);
    error = '';
    await app.savePattern({
      id: pattern?.id ?? crypto.randomUUID(),
      name: name.trim(),
      emoji: emoji.trim() === '' ? '📐' : emoji.trim(),
      monthlyCents: cents,
      annualRatePct: rate,
      active,
    });
    toast.show(t.toasts.saved);
    onclose();
  }

  async function remove() {
    if (!pattern) return;
    if (!confirm(t.confirm.deletePattern)) return;
    await app.deletePattern(pattern.id);
    toast.show(t.toasts.deleted);
    onclose();
  }
</script>

<Modal {open} title={pattern ? t.forms.pattern.editTitle : t.forms.pattern.newTitle} {onclose}>
  <div class="field-row emoji-name">
    <div class="field">
      <label for="pat-emoji">{t.forms.emoji}</label>
      <input id="pat-emoji" class="input emoji" type="text" maxlength="4" bind:value={emoji} />
    </div>
    <div class="field">
      <label for="pat-name">{t.forms.patternName}</label>
      <input
        id="pat-name"
        class="input"
        type="text"
        maxlength="40"
        placeholder={t.forms.patternNamePh}
        bind:value={name}
      />
    </div>
  </div>

  <AmountField id="pat-monthly" label={t.forms.patternMonthly} bind:value={monthly} />

  <div class="field">
    <label for="pat-rate">{t.forms.patternRate}</label>
    <input
      id="pat-rate"
      class="input"
      type="number"
      min="0"
      max="100"
      step="0.1"
      bind:value={rate}
    />
    <small class="muted">{t.forms.patternRateHint}</small>
  </div>

  <label class="check-row">
    <input type="checkbox" bind:checked={active} />
    <span>{t.forms.patternActive}</span>
  </label>

  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if pattern}
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
