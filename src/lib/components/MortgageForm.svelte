<script lang="ts">
  import Modal from './Modal.svelte';
  import AmountField from './AmountField.svelte';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { formatCents, parseAmountToCents } from '../core/money';
  import { currentMonthKey, monthLabel } from '../core/dates';
  import { buildSchedule } from '../core/mortgage';
  import type { Mortgage } from '../core/types';

  interface Props {
    open: boolean;
    mortgage?: Mortgage | null;
    onclose: () => void;
    onsaved?: (m: Mortgage) => void;
  }

  let { open, mortgage = null, onclose, onsaved }: Props = $props();

  let name = $state('');
  let principal = $state('');
  let ratePct = $state(3);
  let termYears = $state(30);
  let termExtra = $state(0);
  let startMonth = $state(currentMonthKey());
  let includeInExpenses = $state(true);
  let error = $state('');

  $effect(() => {
    if (!open) return;
    error = '';
    if (mortgage) {
      name = mortgage.name;
      principal = (mortgage.principalCents / 100).toFixed(2).replace('.', ',');
      ratePct = mortgage.annualRatePct;
      termYears = Math.floor(mortgage.termMonths / 12);
      termExtra = mortgage.termMonths % 12;
      startMonth = mortgage.startMonth;
      includeInExpenses = mortgage.includeInExpenses;
    } else {
      name = '';
      principal = '';
      ratePct = 3;
      termYears = 30;
      termExtra = 0;
      startMonth = currentMonthKey();
      includeInExpenses = true;
    }
  });

  const termMonths = $derived(
    (Number.isFinite(termYears) ? Math.floor(termYears) : 0) * 12 +
      (Number.isFinite(termExtra) ? Math.floor(termExtra) : 0),
  );

  /** Construye la hipoteca desde el formulario, o un mensaje de error. */
  function draft(): Mortgage | string {
    const cents = parseAmountToCents(principal);
    if (cents === null || cents <= 0) return t.forms.errors.amount;
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) return t.forms.errors.rate;
    if (termMonths < 1 || termMonths > 600) return t.forms.errors.term;
    if (!/^\d{4}-\d{2}$/.test(startMonth)) return t.forms.errors.month;
    return {
      id: mortgage?.id ?? crypto.randomUUID(),
      name: name.trim() || t.mortgage.title,
      principalCents: cents,
      annualRatePct: ratePct,
      termMonths,
      startMonth,
      rateChanges: mortgage ? $state.snapshot(mortgage.rateChanges) : [],
      prepayments: mortgage ? $state.snapshot(mortgage.prepayments) : [],
      includeInExpenses,
      createdAt: mortgage?.createdAt ?? new Date().toISOString(),
    };
  }

  const preview = $derived.by(() => {
    const d = draft();
    if (typeof d === 'string') return null;
    const s = buildSchedule(d);
    return t.forms.mortgagePreview(
      formatCents(s.initialPaymentCents, app.settings.currency),
      monthLabel(s.endMonth, 'long'),
    );
  });

  async function save() {
    const d = draft();
    if (typeof d === 'string') return (error = d);
    error = '';
    await app.saveMortgage(d);
    toast.show(t.toasts.saved);
    onsaved?.(d);
    onclose();
  }

  async function remove() {
    if (!mortgage) return;
    if (!confirm(t.confirm.deleteMortgage)) return;
    await app.deleteMortgage(mortgage.id);
    toast.show(t.toasts.deleted);
    onclose();
  }
</script>

<Modal {open} title={mortgage ? t.forms.mortgage.editTitle : t.forms.mortgage.newTitle} {onclose}>
  <div class="field">
    <label for="mtg-name">{t.forms.mortgageName}</label>
    <input
      id="mtg-name"
      class="input"
      type="text"
      maxlength="40"
      placeholder={t.forms.mortgageNamePh}
      bind:value={name}
    />
  </div>

  <AmountField id="mtg-principal" label={t.forms.principal} bind:value={principal} />

  <div class="field">
    <label for="mtg-rate">{t.forms.mortgageRate}</label>
    <input
      id="mtg-rate"
      class="input"
      type="number"
      min="0"
      max="100"
      step="0.01"
      bind:value={ratePct}
    />
    <small class="muted hint">{t.forms.mortgageRateHint}</small>
  </div>

  <div class="field-row">
    <div class="field">
      <label for="mtg-years">{t.forms.termYears}</label>
      <input id="mtg-years" class="input" type="number" min="0" max="50" bind:value={termYears} />
    </div>
    <div class="field">
      <label for="mtg-months">{t.forms.termMonths}</label>
      <input id="mtg-months" class="input" type="number" min="0" max="11" bind:value={termExtra} />
    </div>
  </div>

  <div class="field">
    <label for="mtg-start">{t.forms.startMonth}</label>
    <input id="mtg-start" class="input" type="month" bind:value={startMonth} />
  </div>

  <label class="check-row">
    <input type="checkbox" bind:checked={includeInExpenses} />
    <span>{t.forms.includeInExpenses}</span>
  </label>

  {#if preview}
    <p class="preview num"><i class="fi fi-rr-calculator" aria-hidden="true"></i> {preview}</p>
  {/if}

  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if mortgage}
      <button class="btn btn-danger" onclick={remove}>{t.actions.delete}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn btn-ghost" onclick={onclose}>{t.actions.cancel}</button>
    <button class="btn btn-primary" onclick={save}>{t.actions.save}</button>
  </div>
</Modal>

<style>
  .hint {
    font-size: 12px;
  }
  .preview {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 650;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
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
