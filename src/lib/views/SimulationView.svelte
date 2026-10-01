<script lang="ts">
  import type { ChartConfiguration } from 'chart.js';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { formatCents, formatCentsCompact, parseAmountToCents } from '../core/money';
  import { currentMonthKey } from '../core/dates';
  import { simulatePattern } from '../core/simulate';
  import { token } from '../charts/setup';
  import ChartCanvas from '../components/ChartCanvas.svelte';

  const month = currentMonthKey();
  const currency = $derived(app.settings.currency);

  let initial = $state('1000');
  let monthly = $state('100');
  let ratePct = $state(5);
  let years = $state(10);

  const safeYears = $derived(Math.min(50, Math.max(1, Number.isFinite(years) ? years : 1)));
  const initialCents = $derived(Math.max(0, parseAmountToCents(initial) ?? 0));

  const result = $derived(
    simulatePattern({
      initialCents,
      monthlyCents: Math.max(0, parseAmountToCents(monthly) ?? 0),
      annualRatePct: Number.isFinite(ratePct) ? Math.max(0, ratePct) : 0,
      months: safeYears * 12,
      fromMonth: month,
    }),
  );

  const chartConfig = $derived.by((): ChartConfiguration => {
    void app.settings.theme;
    // Un punto por año para que la gráfica respire en plazos largos.
    const yearly = result.points.filter((_, i) => (i + 1) % 12 === 0);
    const labels = ['Hoy', ...yearly.map((_, i) => `Año ${i + 1}`)];
    const accent = token('--accent');
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: t.simulation.totalSeries,
            data: [initialCents / 100, ...yearly.map((p) => p.totalCents / 100)],
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
            data: [initialCents / 100, ...yearly.map((p) => p.contributedCents / 100)],
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
  </section>

  <section class="card">
    <p class="stat-label">{t.simulation.result(safeYears)}</p>
    <p class="stat-value num">{formatCentsCompact(result.finalCents, currency)}</p>
    <div class="mini-grid">
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
    <p class="card-note" style="margin-top: 10px">{t.simulation.disclaimer}</p>
  </section>
</div>
