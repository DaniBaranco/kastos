<script lang="ts">
  import type { ChartConfiguration } from 'chart.js';
  import { t, durationLabel } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { toast } from '../stores/toast.svelte';
  import { formatCents, formatCentsCompact } from '../core/money';
  import { currentMonthKey, monthLabel } from '../core/dates';
  import {
    mortgageStatus,
    prepaymentSavings,
    rateForMonth,
    scheduleByYear,
  } from '../core/mortgage';
  import type { Mortgage } from '../core/types';
  import { token } from '../charts/setup';
  import { scheduleCSV, downloadFile } from '../export/csv';
  import ChartCanvas from '../components/ChartCanvas.svelte';
  import MortgageForm from '../components/MortgageForm.svelte';
  import MortgageEventForm, { type EventKind } from '../components/MortgageEventForm.svelte';

  const asOf = currentMonthKey();
  const currency = $derived(app.settings.currency);
  const fmt = (c: number) => formatCents(c, currency);
  const pct = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });

  let selectedId = $state<string | null>(null);
  let formOpen = $state(false);
  let editing = $state<Mortgage | null>(null);
  let eventOpen = $state(false);
  let eventKind = $state<EventKind>('rate');
  let eventId = $state<string | null>(null);
  let scheduleMode = $state<'yearly' | 'monthly'>('yearly');

  const entry = $derived(
    app.schedules.find((s) => s.mortgage.id === selectedId) ?? app.schedules[0] ?? null,
  );
  const status = $derived(entry ? mortgageStatus(entry.mortgage, entry.schedule, asOf) : null);
  const years = $derived(entry ? scheduleByYear(entry.schedule.rows) : []);
  const savings = $derived(
    entry && entry.mortgage.prepayments.length > 0
      ? prepaymentSavings(entry.mortgage, entry.schedule)
      : null,
  );

  type EventRow = { id: string; kind: EventKind; month: string; label: string; sub: string };
  const events = $derived.by((): EventRow[] => {
    if (!entry) return [];
    const m = entry.mortgage;
    return [
      ...m.rateChanges.map((r) => ({
        id: r.id,
        kind: 'rate' as const,
        month: r.fromMonth,
        label: t.mortgage.rateChangeLabel(pct(r.annualRatePct)),
        sub: monthLabel(r.fromMonth, 'long'),
      })),
      ...m.prepayments.map((p) => ({
        id: p.id,
        kind: 'prepayment' as const,
        month: p.month,
        label: t.mortgage.prepaymentLabel(fmt(p.amountCents)),
        sub: `${monthLabel(p.month, 'long')} · ${p.mode === 'term' ? t.mortgage.modeTerm : t.mortgage.modePayment}`,
      })),
    ].sort((a, b) => a.month.localeCompare(b.month));
  });

  /** Fila de la cuota "de referencia": la de este mes o la siguiente. */
  const refRow = $derived(status?.current ?? status?.next ?? null);

  function openNew() {
    editing = null;
    formOpen = true;
  }
  function openEdit(m: Mortgage) {
    editing = m;
    formOpen = true;
  }
  function openEvent(kind: EventKind, id: string | null = null) {
    eventKind = kind;
    eventId = id;
    eventOpen = true;
  }
  function exportSchedule() {
    if (!entry) return;
    const slug = entry.mortgage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'hipoteca';
    downloadFile(
      `kastos-cuadro-${slug}.csv`,
      scheduleCSV(entry.mortgage, entry.schedule),
      'text/csv;charset=utf-8',
    );
    toast.show(t.toasts.exported);
  }

  const axis = () => ({
    grid: { color: token('--border') },
    ticks: { color: token('--ink-faint') },
  });
  const euroTicks = (v: string | number) => `${Number(v).toLocaleString('es-ES')} €`;

  const balanceChart = $derived.by((): ChartConfiguration | null => {
    void app.settings.theme;
    if (!entry) return null;
    const rows = entry.schedule.rows;
    const accent = token('--accent');
    const nowIdx = rows.findIndex((r) => r.month >= asOf);
    return {
      type: 'line',
      data: {
        labels: [monthLabel(entry.mortgage.startMonth), ...rows.map((r) => monthLabel(r.month))],
        datasets: [
          {
            label: t.mortgage.balanceSeries,
            data: [entry.mortgage.principalCents / 100, ...rows.map((r) => r.balanceCents / 100)],
            borderColor: accent,
            backgroundColor: `${accent}20`,
            fill: true,
            tension: 0.2,
            borderWidth: 2.5,
            pointRadius: [0, ...rows.map((_, i) => (i === nowIdx ? 5 : 0))],
            pointBackgroundColor: accent,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ...axis(), ticks: { color: token('--ink-faint'), maxTicksLimit: 7 } },
          y: {
            ...axis(),
            beginAtZero: true,
            ticks: { color: token('--ink-faint'), callback: euroTicks },
          },
        },
        plugins: { legend: { display: false } },
      },
    };
  });

  const yearlyChart = $derived.by((): ChartConfiguration | null => {
    void app.settings.theme;
    if (!entry) return null;
    const hasExtra = years.some((y) => y.extraCents > 0);
    return {
      type: 'bar',
      data: {
        labels: years.map((y) => String(y.year)),
        datasets: [
          {
            label: t.mortgage.interestSeries,
            data: years.map((y) => y.interestCents / 100),
            backgroundColor: token('--danger'),
            borderRadius: 4,
          },
          {
            label: t.mortgage.principalSeries,
            data: years.map((y) => y.principalCents / 100),
            backgroundColor: token('--accent'),
            borderRadius: 4,
          },
          ...(hasExtra
            ? [
                {
                  label: t.mortgage.extraSeries,
                  data: years.map((y) => y.extraCents / 100),
                  backgroundColor: token('--positive'),
                  borderRadius: 4,
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ...axis(),
            stacked: true,
            ticks: { color: token('--ink-faint'), maxTicksLimit: 10 },
          },
          y: {
            ...axis(),
            stacked: true,
            ticks: { color: token('--ink-faint'), callback: euroTicks },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: token('--ink-soft'), boxWidth: 12, boxHeight: 12 },
          },
        },
      },
    };
  });
</script>

<header class="view-header">
  <div>
    <h1>{t.mortgage.title}</h1>
    <p class="subtitle">{t.mortgage.subtitle}</p>
  </div>
  {#if app.mortgages.length > 0}
    <button class="btn btn-primary small" onclick={openNew}>
      <i class="fi fi-rr-plus" aria-hidden="true"></i>
      {t.mortgage.new}
    </button>
  {/if}
</header>

{#if !entry || !status}
  <section class="card empty-card">
    <i class="fi fi-rr-home big-icon" aria-hidden="true"></i>
    <p><strong>{t.mortgage.empty}</strong></p>
    <p class="muted">{t.mortgage.emptyHint}</p>
    <button class="btn btn-primary" onclick={openNew}>{t.mortgage.new}</button>
  </section>
{:else}
  {@const m = entry.mortgage}
  {@const s = entry.schedule}

  {#if app.mortgages.length > 1}
    <div class="chips selector" role="group" aria-label={t.mortgage.title}>
      {#each app.mortgages as mm (mm.id)}
        <button class="chip" aria-pressed={mm.id === m.id} onclick={() => (selectedId = mm.id)}>
          {mm.name}
        </button>
      {/each}
    </div>
  {/if}

  <div class="two-col">
    <section class="card">
      <div class="spread">
        <h2>{m.name}</h2>
        <button class="icon-btn" aria-label={t.actions.edit} onclick={() => openEdit(m)}>
          <i class="fi fi-rr-pencil" aria-hidden="true"></i>
        </button>
      </div>

      {#if status.state === 'finished'}
        <p class="badge ok">
          <i class="fi fi-rr-check" aria-hidden="true"></i>
          {t.mortgage.finished}
        </p>
        <p class="muted">{t.mortgage.finishedAt(monthLabel(s.endMonth, 'long'))}</p>
      {:else}
        {#if status.state === 'pending'}
          <p class="badge neutral">{t.mortgage.pending(monthLabel(m.startMonth, 'long'))}</p>
        {/if}
        <p class="stat-label">
          {refRow ? t.mortgage.paymentOf(monthLabel(refRow.month, 'long')) : t.mortgage.payment}
        </p>
        <p class="stat-value num">{fmt(refRow?.paymentCents ?? s.initialPaymentCents)}</p>
        <p class="muted small-text">
          {t.mortgage.rate}: {pct(rateForMonth(m, refRow?.month ?? asOf))} % ·
          {m.includeInExpenses ? t.mortgage.inExpenses : t.mortgage.notInExpenses}
        </p>
      {/if}

      <div
        class="progress"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(status.progressPct)}
        aria-label={t.mortgage.principalPaid}
      >
        <div class="fill-ok" style="width: {status.progressPct}%"></div>
      </div>
      <p class="muted small-text">{t.mortgage.progress(pct(status.progressPct))}</p>

      <div class="mini-grid">
        <div>
          <span class="mini-label">{t.mortgage.outstanding}</span>
          <span class="mini-value num">{fmt(status.outstandingCents)}</span>
        </div>
        <div>
          <span class="mini-label">{t.mortgage.endDate}</span>
          <span class="mini-value">{monthLabel(s.endMonth, 'long')}</span>
        </div>
        <div>
          <span class="mini-label">{t.mortgage.timeLeft}</span>
          <span class="mini-value">{durationLabel(status.paymentsLeft)}</span>
          <span class="mini-hint">{t.mortgage.paymentsLeft(status.paymentsLeft)}</span>
        </div>
        <div>
          <span class="mini-label">{t.mortgage.interestLeft}</span>
          <span class="mini-value num">{fmt(status.interestLeftCents)}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>{t.mortgage.totalPaid}</h2>
      <p class="stat-value num">{fmt(s.totalPaidCents)}</p>
      <div class="mini-grid">
        <div>
          <span class="mini-label">{t.forms.principal}</span>
          <span class="mini-value num">{fmt(m.principalCents)}</span>
        </div>
        <div>
          <span class="mini-label">{t.mortgage.totalInterest}</span>
          <span class="mini-value num" style="color: var(--danger)"
            >{fmt(s.totalInterestCents)}</span
          >
        </div>
        <div>
          <span class="mini-label">{t.mortgage.principalPaid}</span>
          <span class="mini-value num">{fmt(status.principalPaidCents)}</span>
        </div>
        <div>
          <span class="mini-label">{t.mortgage.interestPaid}</span>
          <span class="mini-value num">{fmt(status.interestPaidCents)}</span>
        </div>
      </div>

      {#if refRow && status.state !== 'finished'}
        {@const intPct =
          refRow.paymentCents > 0 ? (refRow.interestCents / refRow.paymentCents) * 100 : 0}
        <p class="stat-label">{t.mortgage.composition}</p>
        <div class="split" aria-hidden="true">
          <div class="split-int" style="width: {intPct}%"></div>
          <div class="split-cap"></div>
        </div>
        <div class="spread legend">
          <span
            ><span class="dot dot-int"></span>{t.mortgage.interestPart}
            {fmt(refRow.interestCents)}</span
          >
          <span
            ><span class="dot dot-cap"></span>{t.mortgage.principalPart}
            {fmt(refRow.principalCents)}</span
          >
        </div>
      {/if}
    </section>
  </div>

  <div class="two-col">
    <section class="card">
      <h2>{t.mortgage.chartBalance}</h2>
      {#if balanceChart}
        <ChartCanvas config={balanceChart} label={t.mortgage.chartBalance} height={230} />
      {/if}
    </section>
    <section class="card">
      <h2>{t.mortgage.chartYearly}</h2>
      {#if yearlyChart}
        <ChartCanvas config={yearlyChart} label={t.mortgage.chartYearly} height={230} />
      {/if}
    </section>
  </div>

  <section class="card">
    <h2>{t.mortgage.events}</h2>
    <p class="card-note">{t.mortgage.eventsHint}</p>
    <div class="event-actions">
      <button class="btn btn-ghost small" onclick={() => openEvent('rate')}>
        <i class="fi fi-rr-percentage" aria-hidden="true"></i>
        {t.mortgage.addRate}
      </button>
      <button class="btn btn-ghost small" onclick={() => openEvent('prepayment')}>
        <i class="fi fi-rr-coins" aria-hidden="true"></i>
        {t.mortgage.addPrepayment}
      </button>
    </div>
    {#if events.length > 0}
      <ul class="row-list">
        {#each events as ev (ev.id)}
          <li>
            <span class="row-emoji" aria-hidden="true">
              <i class="fi {ev.kind === 'rate' ? 'fi-rr-percentage' : 'fi-rr-coins'}"></i>
            </span>
            <div class="row-main">
              <span class="row-title">{ev.label}</span>
              <span class="row-sub">{ev.sub}</span>
            </div>
            <button
              class="icon-btn"
              aria-label={t.actions.edit}
              onclick={() => openEvent(ev.kind, ev.id)}
            >
              <i class="fi fi-rr-pencil" aria-hidden="true"></i>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if savings && (savings.interestSavedCents > 0 || savings.monthsSaved > 0)}
      <p class="badge ok savings">
        <i class="fi fi-rr-piggy-bank" aria-hidden="true"></i>
        {t.mortgage.savings(
          fmt(savings.interestSavedCents),
          savings.monthsSaved > 0 ? durationLabel(savings.monthsSaved) : '',
        )}
      </p>
    {/if}
  </section>

  <section class="card">
    <div class="spread wrap">
      <h2>{t.mortgage.schedule}</h2>
      <div class="seg" role="tablist" aria-label={t.mortgage.schedule}>
        <button
          role="tab"
          aria-selected={scheduleMode === 'yearly'}
          onclick={() => (scheduleMode = 'yearly')}>{t.mortgage.scheduleYearly}</button
        >
        <button
          role="tab"
          aria-selected={scheduleMode === 'monthly'}
          onclick={() => (scheduleMode = 'monthly')}>{t.mortgage.scheduleMonthly}</button
        >
      </div>
    </div>
    <div class="table-scroll schedule">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col"
              >{scheduleMode === 'yearly' ? t.mortgage.colYear : t.mortgage.colMonth}</th
            >
            <th scope="col">{t.mortgage.colPayment}</th>
            <th scope="col">{t.mortgage.colInterest}</th>
            <th scope="col">{t.mortgage.colPrincipal}</th>
            <th scope="col">{t.mortgage.colBalance}</th>
          </tr>
        </thead>
        <tbody>
          {#if scheduleMode === 'yearly'}
            {#each years as y (y.year)}
              <tr class:is-current={String(y.year) === asOf.slice(0, 4)}>
                <th scope="row">{y.year}</th>
                <td>{formatCentsCompact(y.paymentCents + y.extraCents, currency)}</td>
                <td>{formatCentsCompact(y.interestCents, currency)}</td>
                <td>{formatCentsCompact(y.principalCents + y.extraCents, currency)}</td>
                <td>{formatCentsCompact(y.endBalanceCents, currency)}</td>
              </tr>
            {/each}
          {:else}
            {#each s.rows as r (r.n)}
              <tr class:is-current={r.month === asOf}>
                <th scope="row">{monthLabel(r.month)}</th>
                <td>{fmt(r.paymentCents + r.extraCents)}</td>
                <td>{fmt(r.interestCents)}</td>
                <td>{fmt(r.principalCents + r.extraCents)}</td>
                <td>{fmt(r.balanceCents)}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    <button class="btn btn-ghost small export" onclick={exportSchedule}>
      <i class="fi fi-rr-download" aria-hidden="true"></i>
      {t.mortgage.exportSchedule}
    </button>
  </section>

  <MortgageEventForm
    open={eventOpen}
    mortgage={m}
    kind={eventKind}
    {eventId}
    onclose={() => (eventOpen = false)}
  />
{/if}

<MortgageForm
  open={formOpen}
  mortgage={editing}
  onclose={() => (formOpen = false)}
  onsaved={(saved) => (selectedId = saved.id)}
/>

<style>
  .empty-card {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 32px 20px;
  }
  .big-icon {
    font-size: 36px;
    color: var(--accent);
  }
  .selector {
    margin-bottom: 14px;
  }
  .small-text {
    font-size: 12.5px;
    margin: 4px 0 12px;
  }
  .split {
    display: flex;
    height: 12px;
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin: 6px 0 8px;
  }
  .split-int {
    background: var(--danger);
  }
  .split-cap {
    flex: 1;
    background: var(--accent);
  }
  .legend {
    font-size: 12.5px;
    color: var(--ink-soft);
    flex-wrap: wrap;
  }
  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-right: 5px;
  }
  .dot-int {
    background: var(--danger);
  }
  .dot-cap {
    background: var(--accent);
  }
  .event-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0;
  }
  .savings {
    margin-top: 10px;
    white-space: normal;
    line-height: 1.4;
  }
  .wrap {
    flex-wrap: wrap;
  }
  .schedule {
    max-height: 420px;
    overflow-y: auto;
    margin-top: 12px;
  }
  .schedule thead th {
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 1;
  }
  .schedule thead th:first-child {
    z-index: 2;
  }
  .export {
    margin-top: 12px;
  }
</style>
