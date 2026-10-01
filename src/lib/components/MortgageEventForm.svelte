<script lang="ts" module>
  export type EventKind = 'rate' | 'prepayment';
</script>

<script lang="ts">
  import Modal from './Modal.svelte';
  import AmountField from './AmountField.svelte';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { parseAmountToCents } from '../core/money';
  import { currentMonthKey } from '../core/dates';
  import type { Mortgage, Prepayment, RateChange } from '../core/types';

  interface Props {
    open: boolean;
    mortgage: Mortgage;
    kind: EventKind;
    /** Movimiento a editar (null = nuevo). */
    eventId?: string | null;
    onclose: () => void;
  }

  let { open, mortgage, kind, eventId = null, onclose }: Props = $props();

  let month = $state(currentMonthKey());
  let ratePct = $state(3);
  let amount = $state('');
  let mode = $state<Prepayment['mode']>('term');
  let error = $state('');

  const existingRate = $derived(
    kind === 'rate' ? (mortgage.rateChanges.find((r) => r.id === eventId) ?? null) : null,
  );
  const existingPrepay = $derived(
    kind === 'prepayment' ? (mortgage.prepayments.find((p) => p.id === eventId) ?? null) : null,
  );
  const editing = $derived(existingRate !== null || existingPrepay !== null);

  $effect(() => {
    if (!open) return;
    error = '';
    const fallback =
      currentMonthKey() < mortgage.startMonth ? mortgage.startMonth : currentMonthKey();
    if (existingRate) {
      month = existingRate.fromMonth;
      ratePct = existingRate.annualRatePct;
    } else if (existingPrepay) {
      month = existingPrepay.month;
      amount = (existingPrepay.amountCents / 100).toFixed(2).replace('.', ',');
      mode = existingPrepay.mode;
    } else {
      month = fallback;
      ratePct = mortgage.annualRatePct;
      amount = '';
      mode = 'term';
    }
  });

  async function save() {
    if (!/^\d{4}-\d{2}$/.test(month)) return (error = t.forms.errors.month);
    if (month < mortgage.startMonth) return (error = t.forms.errors.beforeStart);

    const next: Mortgage = $state.snapshot(mortgage);
    const id = eventId ?? crypto.randomUUID();

    if (kind === 'rate') {
      if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100)
        return (error = t.forms.errors.rate);
      const rc: RateChange = { id, fromMonth: month, annualRatePct: ratePct };
      next.rateChanges = [...next.rateChanges.filter((r) => r.id !== id), rc].sort((a, b) =>
        a.fromMonth.localeCompare(b.fromMonth),
      );
    } else {
      const cents = parseAmountToCents(amount);
      if (cents === null || cents <= 0) return (error = t.forms.errors.amount);
      const pp: Prepayment = { id, month, amountCents: cents, mode };
      next.prepayments = [...next.prepayments.filter((p) => p.id !== id), pp].sort((a, b) =>
        a.month.localeCompare(b.month),
      );
    }

    error = '';
    await app.saveMortgage(next);
    toast.show(t.toasts.saved);
    onclose();
  }

  async function remove() {
    if (!eventId || !confirm(t.confirm.deleteEvent)) return;
    const next: Mortgage = $state.snapshot(mortgage);
    next.rateChanges = next.rateChanges.filter((r) => r.id !== eventId);
    next.prepayments = next.prepayments.filter((p) => p.id !== eventId);
    await app.saveMortgage(next);
    toast.show(t.toasts.deleted);
    onclose();
  }

  const titles = $derived(kind === 'rate' ? t.forms.rateChange : t.forms.prepayment);
</script>

<Modal {open} title={editing ? titles.editTitle : titles.newTitle} {onclose}>
  <div class="field">
    <label for="ev-month">{kind === 'rate' ? t.forms.rateFrom : t.forms.prepaymentMonth}</label>
    <input id="ev-month" class="input" type="month" min={mortgage.startMonth} bind:value={month} />
  </div>

  {#if kind === 'rate'}
    <div class="field">
      <label for="ev-rate">{t.forms.newRate}</label>
      <input
        id="ev-rate"
        class="input"
        type="number"
        min="0"
        max="100"
        step="0.01"
        bind:value={ratePct}
      />
    </div>
  {:else}
    <AmountField id="ev-amount" label={t.forms.amount} bind:value={amount} />
    <fieldset class="field">
      <legend>{t.forms.prepaymentMode}</legend>
      <label class="check-row">
        <input type="radio" name="ev-mode" value="term" bind:group={mode} />
        <span>{t.forms.modeTerm}</span>
      </label>
      <label class="check-row">
        <input type="radio" name="ev-mode" value="payment" bind:group={mode} />
        <span>{t.forms.modePayment}</span>
      </label>
    </fieldset>
  {/if}

  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="actions">
    {#if editing}
      <button class="btn btn-danger" onclick={remove}>{t.actions.delete}</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn btn-ghost" onclick={onclose}>{t.actions.cancel}</button>
    <button class="btn btn-primary" onclick={save}>{t.actions.save}</button>
  </div>
</Modal>

<style>
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }
  legend {
    font-size: 13px;
    font-weight: 650;
    color: var(--ink-soft);
    margin-bottom: 6px;
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
