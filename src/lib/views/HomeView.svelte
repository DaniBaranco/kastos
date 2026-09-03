<script lang="ts">
  import type { ChartConfiguration } from 'chart.js';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { formatCents, formatCentsCompact } from '../core/money';
  import { addMonths, currentMonthKey, monthLabel } from '../core/dates';
  import {
    accumulatedSeries,
    fulfilledStreak,
    savedInMonthCents,
    savingsRateCents,
    totalSavedCents,
  } from '../core/savings';
  import { toast } from '../stores/toast.svelte';
  import { simulatePattern } from '../core/simulate';
  import { token } from '../charts/setup';
  import ChartCanvas from '../components/ChartCanvas.svelte';
  import SavingsEntryForm from '../components/SavingsEntryForm.svelte';
  import PatternForm from '../components/PatternForm.svelte';
  import type { SavingsEntry, SavingsPattern } from '../core/types';

  let entryFormOpen = $state(false);
  let entryFormInitial = $state(false);
  let editingEntry = $state<SavingsEntry | null>(null);
  let patternFormOpen = $state(false);
  let editingPattern = $state<SavingsPattern | null>(null);

  const month = currentMonthKey();
  const currency = $derived(app.settings.currency);
  const total = $derived(totalSavedCents(app.savingsEntries));
  const thisMonth = $derived(savedInMonthCents(app.savingsEntries, month));
  const rate = $derived(savingsRateCents(app.savingsEntries, month, 6));
  const pattern = $derived(app.activePattern);

  const greeting = $derived.by(() => {
    const h = new Date().getHours();
    const base = h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    return app.settings.userName ? `${base}, ${app.settings.userName}` : base;
  });

  /** Estado del mes frente al patrón activo. */
  const monthState = $derived.by(() => {
    if (!pattern) return null;
    if (thisMonth >= pattern.monthlyCents) return 'ok' as const;
    if (thisMonth > 0) return 'partial' as const;
    return 'none' as const;
  });

  const streak = $derived(
    pattern ? fulfilledStreak(app.savingsEntries, pattern.monthlyCents, month) : 0,
  );

  /** Lo que falta para cumplir el patrón este mes (para el botón de un toque). */
  const remainingCents = $derived(
    pattern ? Math.max(0, pattern.monthlyCents - Math.max(0, thisMonth)) : 0,
  );
  const monthName = $derived(monthLabel(month, 'long').split(' ')[0]!.toLowerCase());

  /** Un toque: crea la aportación que cumple el patrón del mes. */
  async function fulfillPattern() {
    if (!pattern || remainingCents <= 0) return;
    await app.saveEntry({
      id: crypto.randomUUID(),
      month,
      amountCents: remainingCents,
      note: t.home.fulfillNote(pattern.name),
      createdAt: new Date().toISOString(),
    });
    toast.show(t.home.monthOk);
  }

  const PROJECTION_MONTHS = 12;

  const projection = $derived(
    pattern
      ? simulatePattern({
          initialCents: total,
          monthlyCents: pattern.monthlyCents,
          annualRatePct: pattern.annualRatePct,
          months: PROJECTION_MONTHS,
          fromMonth: month,
        })
      : null,
  );

  // ── Gráfica: acumulado real + proyección punteada con el patrón ──
  const evolutionConfig = $derived.by((): ChartConfiguration => {
    void app.settings.theme; // recolorear al cambiar el tema
    const from = addMonths(month, -11);
    const real = accumulatedSeries(app.savingsEntries, from, month);
    const proj = projection?.points ?? [];
    const labels = [
      ...real.map((p) => monthLabel(p.month)),
      ...proj.map((p) => monthLabel(p.month)),
    ];
    const realData = real.map((p) => p.accumulatedCents / 100);
    const projData = [
      ...Array<number | null>(Math.max(0, real.length - 1)).fill(null),
      realData.at(-1) ?? 0,
      ...proj.map((p) => p.totalCents / 100),
    ];
    const accent = token('--accent');
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: t.home.pot,
            data: [...realData, ...Array<number | null>(proj.length).fill(null)],
            borderColor: accent,
            backgroundColor: `${accent}20`,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5,
          },
          {
            label: 'Proyección',
            data: projData,
            borderColor: token('--ink-faint'),
            borderDash: [5, 5],
            fill: false,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { color: token('--border') },
            ticks: { color: token('--ink-faint'), maxTicksLimit: 8 },
          },
          y: {
            grid: { color: token('--border') },
            ticks: {
              color: token('--ink-faint'),
              callback: (v) => `${Number(v).toLocaleString('es-ES')} €`,
            },
            beginAtZero: true,
          },
        },
        plugins: { legend: { display: false } },
      },
    };
  });

  const goalById = $derived(new Map(app.goals.map((g) => [g.id, g])));
  const recentEntries = $derived(
    [...app.savingsEntries].sort(
      (a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt),
    ),
  );
</script>

<header class="view-header">
  <div>
    <p class="greeting">{greeting}</p>
    <h1>{t.home.title}</h1>
  </div>
  <button
    class="btn btn-primary small"
    onclick={() => {
      editingEntry = null;
      entryFormInitial = false;
      entryFormOpen = true;
    }}><i class="fi fi-rr-plus" aria-hidden="true"></i> {t.home.addEntry}</button
  >
</header>

{#if app.savingsEntries.length === 0}
  <!-- Primer arranque: partimos de cero, con opción de traer la bolsa previa -->
  <section class="card start-card">
    <h2>{t.home.startTitle}</h2>
    <p class="card-note">{t.home.startText}</p>
    <button
      class="btn btn-ghost"
      style="margin-top: 12px"
      onclick={() => {
        editingEntry = null;
        entryFormInitial = true;
        entryFormOpen = true;
      }}><i class="fi fi-rr-bank" aria-hidden="true"></i> {t.home.startCta}</button
    >
  </section>
{/if}

<div class="two-col">
  <div class="stack">
    <!-- La bolsa -->
    <section class="card">
      <p class="stat-label">{t.home.pot}</p>
      <p class="stat-value num" class:negative={total < 0}>
        {formatCentsCompact(total, currency)}
      </p>
      <div class="mini-stats">
        <div>
          <span class="mini-label">{t.home.thisMonth}</span>
          <span class="num mini-value">{formatCents(thisMonth, currency)}</span>
        </div>
        <div>
          <span class="mini-label">{t.home.rate}</span>
          <span class="num mini-value">{formatCents(rate, currency)}</span>
          <span class="mini-hint">{t.home.rateHint}</span>
        </div>
      </div>
    </section>

    <!-- Patrón de ahorro y estado del mes -->
    <section class="card">
      <div class="spread">
        <h2>{t.home.pattern}</h2>
        <button
          class="link-btn"
          onclick={() => {
            editingPattern = null;
            patternFormOpen = true;
          }}>{t.home.newPattern}</button
        >
      </div>

      {#if pattern}
        <p class="pattern-line">
          <span aria-hidden="true">{pattern.emoji}</span>
          <strong>{pattern.name}</strong> ·
          <span class="num"
            >{t.home.patternMonthly(formatCents(pattern.monthlyCents, currency))}</span
          >
          {#if pattern.annualRatePct > 0}
            <span class="muted"
              >· {t.patterns.withInterest(pattern.annualRatePct.toLocaleString('es-ES'))}</span
            >
          {/if}
        </p>

        {#if monthState === 'ok'}
          <p class="badge ok"><i class="fi fi-rr-check" aria-hidden="true"></i> {t.home.monthOk}</p>
        {:else if monthState === 'partial'}
          <p class="badge warn">
            <i class="fi fi-rr-arrow-small-right" aria-hidden="true"></i>
            {t.home.monthPartial(
              formatCents(thisMonth, currency),
              formatCents(pattern.monthlyCents, currency),
            )}
          </p>
        {:else}
          <p class="badge neutral">· {t.home.monthNone}</p>
        {/if}
        <div class="progress" style="margin-top: 10px">
          <div
            class={monthState === 'ok' ? 'fill-ok' : undefined}
            style:width={`${Math.min(100, Math.max(0, (thisMonth / pattern.monthlyCents) * 100))}%`}
          ></div>
        </div>

        {#if monthState !== 'ok' && remainingCents > 0}
          <!-- El gesto central de la app, en un toque -->
          <button class="btn btn-primary fulfill" onclick={fulfillPattern}>
            <i class="fi fi-rr-check" aria-hidden="true"></i>
            {monthState === 'none'
              ? t.home.fulfillNow(formatCents(remainingCents, currency), monthName)
              : t.home.completeNow(formatCents(remainingCents, currency), monthName)}
          </button>
        {/if}

        {#if streak > 0}
          <p class="streak">
            <i class="fi fi-rr-flame" aria-hidden="true"></i>
            {t.home.streak(streak)}
          </p>
        {/if}
      {:else}
        <p class="empty">
          {t.home.patternNone}
          <small>{t.home.patternNoneHint}</small>
        </p>
      {/if}

      {#if app.patterns.length > 0}
        <ul class="pattern-list">
          {#each app.patterns as p (p.id)}
            <li>
              <button
                class="pattern-chip"
                class:is-active={p.active}
                onclick={() => {
                  editingPattern = p;
                  patternFormOpen = true;
                }}
              >
                <span aria-hidden="true">{p.emoji}</span>
                {p.name} ·
                <span class="num">{formatCentsCompact(p.monthlyCents, currency)}/mes</span>
                {#if p.active}<span class="badge ok chip-badge"
                    ><i class="fi fi-rr-check" aria-hidden="true"></i> {t.patterns.active}</span
                  >{/if}
              </button>
              {#if !p.active}
                <button class="link-btn" onclick={() => app.savePattern({ ...p, active: true })}
                  >{t.patterns.activate}</button
                >
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Evolución + proyección -->
    <section class="card">
      <h2>Evolución</h2>
      <ChartCanvas config={evolutionConfig} label="Evolución de la bolsa de ahorro" />
      {#if projection && pattern}
        <p class="card-note" style="margin-top: 10px">
          {t.home.projectionNote(PROJECTION_MONTHS, formatCents(projection.finalCents, currency))}
        </p>
      {/if}
    </section>
  </div>

  <!-- Historial -->
  <section class="card">
    <h2>{t.home.entries}</h2>
    {#if recentEntries.length === 0}
      <p class="empty">
        {t.home.empty}
        <small>{t.home.emptyHint}</small>
      </p>
    {:else}
      <ul class="row-list">
        {#each recentEntries.slice(0, 14) as e (e.id)}
          {@const goal = e.goalId !== undefined ? goalById.get(e.goalId) : undefined}
          <li>
            <button
              class="row-btn"
              onclick={() => {
                editingEntry = e;
                entryFormOpen = true;
              }}
            >
              <span class="row-emoji">
                {#if e.initial}<i class="fi fi-rr-bank" aria-hidden="true"></i>
                {:else if e.amountCents < 0}<i class="fi fi-rr-undo" aria-hidden="true"></i>
                {:else if goal}{goal.emoji}
                {:else}<i class="fi fi-rr-piggy-bank" aria-hidden="true"></i>{/if}
              </span>
              <span class="row-main">
                <span class="row-title"
                  >{e.initial
                    ? t.home.initialLabel
                    : e.amountCents < 0
                      ? t.home.withdraw
                      : (goal?.name ?? t.forms.noGoal)}</span
                >
                <span class="row-sub"
                  >{monthLabel(e.month, 'long')}{e.note ? ` · ${e.note}` : ''}</span
                >
              </span>
              <span class="row-amount num {e.amountCents < 0 ? 'negative' : 'income'}">
                {e.amountCents < 0 ? '−' : '+'}{formatCents(Math.abs(e.amountCents), currency)}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<SavingsEntryForm
  open={entryFormOpen}
  entry={editingEntry}
  startAsInitial={entryFormInitial}
  onclose={() => {
    entryFormOpen = false;
    entryFormInitial = false;
    editingEntry = null;
  }}
/>
<PatternForm
  open={patternFormOpen}
  pattern={editingPattern}
  onclose={() => {
    patternFormOpen = false;
    editingPattern = null;
  }}
/>

<style>
  .greeting {
    font-size: 13px;
    color: var(--ink-soft);
  }
  .fulfill {
    width: 100%;
    margin-top: 14px;
  }
  .streak {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 12px;
    font-size: 13.5px;
    font-weight: 650;
  }
  .streak i.fi {
    color: var(--warning);
  }
  .start-card {
    margin-bottom: 14px;
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
    background: color-mix(in srgb, var(--accent-soft) 45%, var(--surface));
  }
  .mini-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }
  .mini-stats > div {
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mini-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-soft);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .mini-value {
    font-size: 16px;
    font-weight: 650;
  }
  .mini-hint {
    font-size: 10.5px;
    color: var(--ink-faint);
  }
  .pattern-line {
    font-size: 14.5px;
    margin-bottom: 10px;
  }
  .pattern-list {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pattern-list li {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pattern-chip {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 7px;
    text-align: left;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 13.5px;
    font-weight: 600;
  }
  .pattern-chip.is-active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chip-badge {
    margin-left: auto;
  }
  .row-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
  }
</style>
