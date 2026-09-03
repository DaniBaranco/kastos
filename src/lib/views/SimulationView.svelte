<script lang="ts">
  import type { ChartConfiguration } from 'chart.js';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { formatCents, formatCentsCompact, parseAmountToCents } from '../core/money';
  import { currentMonthKey, monthLabel } from '../core/dates';
  import { totalSavedCents } from '../core/savings';
  import { simulatePattern } from '../core/simulate';
  import { token } from '../charts/setup';
  import ChartCanvas from '../components/ChartCanvas.svelte';
  import PatternForm from '../components/PatternForm.svelte';
  import type { SavingsPattern } from '../core/types';

  let patternFormOpen = $state(false);
  let editingPattern = $state<SavingsPattern | null>(null);
  let patternPreset = $state<{ monthlyCents: number; annualRatePct: number } | null>(null);

  const month = currentMonthKey();
  const currency = $derived(app.settings.currency);
  const pot = $derived(totalSavedCents(app.savingsEntries));

  // ── Calculadora en vivo: todo en la misma pantalla, sin pasos ──
  let initial = $state('0');
  let monthly = $state('100');
  let ratePct = $state(0);
  let years = $state(10);
  let potLoaded = $state(false);

  // Al entrar con datos, precargar la bolsa actual como capital inicial (una vez).
  $effect(() => {
    if (!potLoaded && app.ready) {
      if (pot > 0) initial = (pot / 100).toFixed(2).replace('.', ',');
      potLoaded = true;
    }
  });

  const safeYears = $derived(Math.min(50, Math.max(1, Number.isFinite(years) ? years : 1)));

  const result = $derived(
    simulatePattern({
      initialCents: parseAmountToCents(initial) ?? 0,
      monthlyCents: Math.max(0, parseAmountToCents(monthly) ?? 0),
      annualRatePct: Number.isFinite(ratePct) ? Math.max(0, ratePct) : 0,
      months: safeYears * 12,
      fromMonth: month,
    }),
  );

  // ── Objetivos sobre la simulación: ¿cuándo cruza tu curva cada importe? ──
  interface GoalMark {
    goal: (typeof app.goals)[number];
    status: 'covered' | 'reached' | 'beyond';
    label: string | null;
  }

  const goalMarks = $derived.by((): GoalMark[] => {
    const startCents = parseAmountToCents(initial) ?? 0;
    return app.goals
      .filter((g) => !g.archived)
      .toSorted((a, b) => a.targetCents - b.targetCents)
      .map((goal) => {
        if (startCents >= goal.targetCents)
          return { goal, status: 'covered' as const, label: null };
        const hit = result.points.find((p) => p.totalCents >= goal.targetCents);
        return hit
          ? { goal, status: 'reached' as const, label: monthLabel(hit.month, 'long') }
          : { goal, status: 'beyond' as const, label: null };
      });
  });

  const chartConfig = $derived.by((): ChartConfiguration => {
    void app.settings.theme;
    // Un punto por año para que la gráfica respire en plazos largos.
    const yearly = result.points.filter((_, i) => (i + 1) % 12 === 0);
    const startCents = parseAmountToCents(initial) ?? 0;
    const labels = ['Hoy', ...yearly.map((_, i) => `Año ${i + 1}`)];
    const accent = token('--accent');
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: t.simulation.totalSeries,
            data: [startCents / 100, ...yearly.map((p) => p.totalCents / 100)],
            borderColor: accent,
            backgroundColor: `${accent}20`,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5,
          },
          {
            label: t.simulation.contributedSeries,
            data: [startCents / 100, ...yearly.map((p) => p.contributedCents / 100)],
            borderColor: token('--ink-faint'),
            borderDash: [5, 5],
            fill: false,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          // Líneas horizontales con el importe de cada objetivo (máx. 4)
          ...goalMarks.slice(0, 4).map((m) => ({
            label: `${m.goal.emoji} ${m.goal.name}`,
            data: Array<number>(labels.length).fill(m.goal.targetCents / 100),
            borderColor: token('--border-strong'),
            borderDash: [3, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
          })),
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
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: token('--ink-soft'), boxWidth: 14, boxHeight: 3 },
          },
        },
      },
    };
  });

  function useMyPot() {
    initial = (pot / 100).toFixed(2).replace('.', ',');
  }

  function applyPattern(p: SavingsPattern) {
    monthly = (p.monthlyCents / 100).toFixed(2).replace('.', ',');
    ratePct = p.annualRatePct;
  }

  function saveAsPattern() {
    patternPreset = {
      monthlyCents: Math.max(0, parseAmountToCents(monthly) ?? 0),
      annualRatePct: Number.isFinite(ratePct) ? Math.max(0, ratePct) : 0,
    };
    editingPattern = null;
    patternFormOpen = true;
  }
</script>

<header class="view-header">
  <div>
    <h1>{t.simulation.title}</h1>
    <p class="subtitle">{t.simulation.subtitle}</p>
  </div>
</header>

<div class="two-col">
  <section class="card">
    <h2>{t.simulation.calcTitle}</h2>

    <div class="field-row">
      <div class="field">
        <label for="sim-initial">{t.simulation.initial}</label>
        <input id="sim-initial" class="input num" inputmode="decimal" bind:value={initial} />
      </div>
      <div class="field">
        <label for="sim-monthly">{t.simulation.monthly}</label>
        <input id="sim-monthly" class="input num" inputmode="decimal" bind:value={monthly} />
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="sim-rate">{t.simulation.rate}</label>
        <input
          id="sim-rate"
          class="input"
          type="number"
          min="0"
          max="30"
          step="0.1"
          bind:value={ratePct}
        />
      </div>
      <div class="field">
        <label for="sim-years">{t.simulation.years}</label>
        <input id="sim-years" class="input" type="number" min="1" max="50" bind:value={years} />
      </div>
    </div>

    <div class="calc-actions">
      {#if pot > 0}
        <button class="btn btn-ghost small" onclick={useMyPot}>
          <i class="fi fi-rr-piggy-bank" aria-hidden="true"></i>
          {t.simulation.useMyPot(formatCentsCompact(pot, currency))}
        </button>
      {/if}
      <button class="btn btn-ghost small" onclick={saveAsPattern}>
        <i class="fi fi-rr-bookmark" aria-hidden="true"></i>
        {t.simulation.saveAsPattern}
      </button>
    </div>

    {#if app.patterns.length > 0}
      <div class="patterns-block">
        <h3>{t.patterns.listTitle}</h3>
        <p class="card-note">{t.patterns.listHint}</p>
        <ul class="pattern-list">
          {#each app.patterns as p (p.id)}
            <li>
              <button
                class="pattern-chip"
                class:is-active={p.active}
                onclick={() => {
                  editingPattern = p;
                  patternPreset = null;
                  patternFormOpen = true;
                }}
              >
                <span aria-hidden="true">{p.emoji}</span>
                {p.name} ·
                <span class="num">{formatCentsCompact(p.monthlyCents, currency)}/mes</span>
                {#if p.annualRatePct > 0}
                  <span class="muted num">· {p.annualRatePct.toLocaleString('es-ES')} %</span>
                {/if}
                {#if p.active}<span class="badge ok chip-badge"
                    ><i class="fi fi-rr-check" aria-hidden="true"></i> {t.patterns.active}</span
                  >{/if}
              </button>
              <button class="link-btn" onclick={() => applyPattern(p)}>{t.patterns.apply}</button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>

  <section class="card">
    <p class="stat-label">{t.simulation.result(safeYears)}</p>
    <p class="stat-value num" style="color: var(--accent)">
      {formatCentsCompact(result.finalCents, currency)}
    </p>
    <div class="breakdown">
      <div>
        <span class="mini-label">{t.simulation.contributed}</span>
        <span class="num mini-value">{formatCents(result.contributedCents, currency)}</span>
      </div>
      <div>
        <span class="mini-label">{t.simulation.interest}</span>
        <span class="num mini-value" style="color: var(--positive)"
          >{formatCents(Math.max(0, result.interestCents), currency)}</span
        >
      </div>
    </div>
    <ChartCanvas config={chartConfig} label={t.simulation.chartLabel} height={230} />

    {#if goalMarks.length > 0}
      <div class="goal-marks">
        <h3>{t.simulation.goalsTitle}</h3>
        <ul>
          {#each goalMarks as m (m.goal.id)}
            <li>
              <span class="gm-name">
                <span aria-hidden="true">{m.goal.emoji}</span>
                {m.goal.name}
                <span class="muted num">({formatCentsCompact(m.goal.targetCents, currency)})</span>
              </span>
              <span class="gm-status" class:ok={m.status !== 'beyond'}>
                {#if m.status === 'covered'}
                  <i class="fi fi-rr-check" aria-hidden="true"></i>
                  {t.simulation.goalCovered}
                {:else if m.status === 'reached'}
                  <i class="fi fi-rr-flag" aria-hidden="true"></i>
                  {t.simulation.goalReachedAt(m.label ?? '')}
                {:else}
                  <i class="fi fi-rr-arrow-small-right" aria-hidden="true"></i>
                  {t.simulation.goalBeyond}
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <p class="card-note" style="margin-top: 10px">{t.simulation.disclaimer}</p>
  </section>
</div>

<PatternForm
  open={patternFormOpen}
  pattern={editingPattern}
  preset={patternPreset}
  onclose={() => {
    patternFormOpen = false;
    editingPattern = null;
    patternPreset = null;
  }}
/>

<style>
  .calc-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .patterns-block {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
  .patterns-block h3 {
    font-size: 13px;
    font-weight: 650;
    margin-bottom: 4px;
  }
  .pattern-list {
    margin-top: 10px;
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
    flex-wrap: wrap;
  }
  .pattern-chip.is-active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chip-badge {
    margin-left: auto;
  }
  .goal-marks {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .goal-marks h3 {
    font-size: 13px;
    font-weight: 650;
    margin-bottom: 8px;
  }
  .goal-marks li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    font-size: 13.5px;
  }
  .gm-name {
    font-weight: 650;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gm-name .muted {
    font-weight: 500;
    font-size: 12px;
  }
  .gm-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  .gm-status.ok {
    color: var(--positive);
    font-weight: 650;
  }
  .breakdown {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 12px 0 16px;
  }
  .breakdown > div {
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
</style>
