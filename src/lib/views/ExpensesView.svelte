<script lang="ts">
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { formatCents } from '../core/money';
  import { addMonths, currentMonthKey, monthLabel } from '../core/dates';
  import {
    MORTGAGE_CATEGORY_ID,
    averageMonthlyCents,
    categoryTotals,
    compareMonth,
    mortgageItems,
    pctChange,
    toItems,
  } from '../core/expenses';
  import type { Expense } from '../core/types';
  import ExpenseForm from '../components/ExpenseForm.svelte';

  const thisMonth = currentMonthKey();
  const currency = $derived(app.settings.currency);
  const fmt = (c: number) => formatCents(c, currency);

  let month = $state(thisMonth);
  let formOpen = $state(false);
  let editing = $state<Expense | null>(null);

  const prevMonth = $derived(addMonths(month, -1));

  // Gastos reales + cuota hipotecaria (virtual) del último año hasta el mes visto.
  const items = $derived([
    ...toItems(app.expenses),
    ...mortgageItems(app.schedules, addMonths(month, -12), month),
  ]);
  const comparison = $derived(compareMonth(items, month));
  const vsPrev = $derived(pctChange(comparison.currentCents, comparison.previousCents));
  const vsYear = $derived(pctChange(comparison.currentCents, comparison.lastYearCents));
  const average = $derived(averageMonthlyCents(items, addMonths(month, -11), month));

  const totals = $derived(categoryTotals(items, month));
  const maxTotal = $derived(Math.max(1, ...totals.map((x) => x.amountCents)));

  const monthExpenses = $derived(
    app.expenses.filter((e) => e.month === month).sort((a, b) => b.amountCents - a.amountCents),
  );
  const mortgageCents = $derived(
    items
      .filter((i) => i.month === month && i.categoryId === MORTGAGE_CATEGORY_ID)
      .reduce((s, i) => s + i.amountCents, 0),
  );
  const prevCount = $derived(app.expenses.filter((e) => e.month === prevMonth).length);

  function catInfo(id: string): { name: string; emoji: string } {
    if (id === MORTGAGE_CATEGORY_ID) return { name: t.expenses.mortgageRow, emoji: '🏠' };
    const c = app.categoryById.get(id);
    return c ? { name: c.name, emoji: c.emoji } : { name: '—', emoji: '❔' };
  }

  function openNew() {
    editing = null;
    formOpen = true;
  }
  function openEdit(e: Expense) {
    editing = e;
    formOpen = true;
  }
  async function copyPrevious() {
    const n = await app.copyMonth(prevMonth, month);
    toast.show(t.expenses.copied(n));
  }
  async function removeExpense(e: Expense) {
    const snapshot = $state.snapshot(e) as Expense;
    await app.deleteExpense(e.id);
    toast.show(t.toasts.expenseDeleted(catInfo(e.categoryId).name), 'ok', {
      label: t.actions.undo,
      run: () => app.saveExpense(snapshot),
    });
  }

  function deltaText(p: number | null): string {
    if (p === null) return t.expenses.noData;
    const sign = p > 0 ? '+' : p < 0 ? '−' : '±';
    return `${sign}${Math.abs(p).toLocaleString('es-ES', { maximumFractionDigits: 0 })} %`;
  }
  function deltaClass(p: number | null): string {
    if (p === null || Math.abs(p) < 0.5) return 'muted';
    return p > 0 ? 'delta-up' : 'delta-down';
  }
</script>

<header class="view-header">
  <div>
    <h1>{t.expenses.title}</h1>
    <p class="subtitle">{t.expenses.subtitle}</p>
  </div>
  <button class="btn btn-primary small" onclick={openNew}>
    <i class="fi fi-rr-plus" aria-hidden="true"></i>
    {t.expenses.add}
  </button>
</header>

<nav class="month-nav card" aria-label={t.forms.month}>
  <button class="icon-btn" aria-label={t.expenses.prevMonth} onclick={() => (month = prevMonth)}>
    <i class="fi fi-rr-angle-small-left" aria-hidden="true"></i>
  </button>
  <div class="month-title">
    <strong>{monthLabel(month, 'long')}</strong>
    {#if month !== thisMonth}
      <button class="link-btn" onclick={() => (month = thisMonth)}>{t.expenses.today}</button>
    {/if}
  </div>
  <button
    class="icon-btn"
    aria-label={t.expenses.nextMonth}
    onclick={() => (month = addMonths(month, 1))}
  >
    <i class="fi fi-rr-angle-small-right" aria-hidden="true"></i>
  </button>
</nav>

<div class="two-col">
  <section class="card">
    <p class="stat-label">{t.expenses.total}</p>
    <p class="stat-value num">{fmt(comparison.currentCents)}</p>
    {#if monthExpenses.length > 0}
      <div class="mini-grid">
        <div>
          <span class="mini-label">{t.expenses.vsPrevious}</span>
          <span class="mini-value num {deltaClass(vsPrev)}">{deltaText(vsPrev)}</span>
          {#if comparison.previousCents !== null}
            <span class="mini-hint num">{fmt(comparison.previousCents)}</span>
          {/if}
        </div>
        <div>
          <span class="mini-label">{t.expenses.vsLastYear}</span>
          <span class="mini-value num {deltaClass(vsYear)}">{deltaText(vsYear)}</span>
          {#if comparison.lastYearCents !== null}
            <span class="mini-hint num">{fmt(comparison.lastYearCents)}</span>
          {/if}
        </div>
      </div>
    {/if}
    {#if average !== null}
      <p class="card-note">{t.expenses.average(fmt(average))}</p>
    {/if}
  </section>

  <section class="card">
    <h2>{t.expenses.byCategory}</h2>
    {#if totals.length === 0}
      <p class="empty">{t.expenses.empty}</p>
    {:else}
      <ul class="bars">
        {#each totals as row (row.categoryId)}
          {@const info = catInfo(row.categoryId)}
          <li>
            <div class="spread">
              <span><span aria-hidden="true">{info.emoji}</span> {info.name}</span>
              <span class="num">{fmt(row.amountCents)}</span>
            </div>
            <div class="bar" aria-hidden="true">
              <div style="width: {(row.amountCents / maxTotal) * 100}%"></div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<section class="card">
  <h2>{t.expenses.entries}</h2>
  {#if monthExpenses.length === 0 && mortgageCents === 0}
    <div class="empty">
      <p>{t.expenses.empty}</p>
      <small>{t.expenses.emptyHint}</small>
    </div>
  {/if}

  {#if monthExpenses.length === 0 && prevCount > 0}
    <button class="btn btn-ghost small copy" onclick={copyPrevious}>
      <i class="fi fi-rr-copy" aria-hidden="true"></i>
      {t.expenses.copyFrom(monthLabel(prevMonth, 'long'))}
    </button>
  {/if}

  <ul class="row-list">
    {#if mortgageCents > 0}
      <li>
        <span class="row-emoji" aria-hidden="true">🏠</span>
        <div class="row-main">
          <span class="row-title">{t.expenses.mortgageRow}</span>
          <span class="row-sub">{t.expenses.mortgageAuto}</span>
        </div>
        <span class="row-amount num">{fmt(mortgageCents)}</span>
        <span class="row-delete-spacer" aria-hidden="true"></span>
      </li>
    {/if}
    {#each monthExpenses as e (e.id)}
      {@const info = catInfo(e.categoryId)}
      <li>
        <span class="row-emoji" aria-hidden="true">{info.emoji}</span>
        <button class="row-main as-button" onclick={() => openEdit(e)}>
          <span class="row-title">{info.name}</span>
          {#if e.note}<span class="row-sub">{e.note}</span>{/if}
        </button>
        <span class="row-amount num">{fmt(e.amountCents)}</span>
        <button
          class="icon-btn danger row-delete"
          aria-label="{t.actions.delete} {info.name}"
          title={t.actions.delete}
          onclick={() => removeExpense(e)}
        >
          <i class="fi fi-rr-trash" aria-hidden="true"></i>
        </button>
      </li>
    {/each}
  </ul>
</section>

<ExpenseForm
  open={formOpen}
  expense={editing}
  defaultMonth={month}
  onclose={() => (formOpen = false)}
/>

<style>
  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    margin-bottom: 14px;
  }
  .month-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 17px;
  }
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
  }
  .bar {
    height: 8px;
    background: var(--bg);
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin-top: 4px;
  }
  .bar > div {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-pill);
  }
  .copy {
    margin: 0 auto 8px;
    display: flex;
  }
  .row-delete {
    flex-shrink: 0;
    margin-right: -6px;
  }
  .row-delete-spacer {
    width: 28px;
    flex-shrink: 0;
  }
  .as-button {
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
</style>
