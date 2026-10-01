<script lang="ts">
  import type { ChartConfiguration } from 'chart.js';
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { formatCents, formatCentsCompact } from '../core/money';
  import { addMonths, currentMonthKey, monthLabel, monthRange } from '../core/dates';
  import {
    MORTGAGE_CATEGORY_ID,
    categoryMatrix,
    monthlySeries,
    mortgageItems,
    seasonExtremes,
    seasonality,
    toItems,
    trackedMonths,
  } from '../core/expenses';
  import { token } from '../charts/setup';
  import ChartCanvas from '../components/ChartCanvas.svelte';

  type Range = '12' | '24' | 'all';

  const thisMonth = currentMonthKey();
  const currency = $derived(app.settings.currency);
  const fmt = (c: number) => formatCents(c, currency);

  const CAL_MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
  );
  const CAL_MONTHS_LONG = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString('es-ES', { month: 'long' }),
  );

  let selected = $state<string>('all');
  let range = $state<Range>('12');

  const expenseItems = $derived(toItems(app.expenses));
  const tracked = $derived(trackedMonths(expenseItems));
  const first = $derived(tracked[0] ?? thisMonth);
  const last = $derived(
    tracked.length > 0 && tracked.at(-1)! > thisMonth ? tracked.at(-1)! : thisMonth,
  );

  // La hipoteca solo cuenta dentro del rango en el que registras gastos.
  const items = $derived([...expenseItems, ...mortgageItems(app.schedules, first, last)]);

  const months = $derived.by(() => {
    if (range === 'all') return monthRange(first, last);
    const from = addMonths(last, -(Number(range) - 1));
    return monthRange(from < first ? first : from, last);
  });

  const catArg = $derived(selected === 'all' ? undefined : selected);

  const options = $derived.by(() => {
    const used = new Set(app.expenses.map((e) => e.categoryId));
    const list = app.categories
      .filter((c) => used.has(c.id))
      .map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }));
    if (app.mortgages.some((m) => m.includeInExpenses)) {
      list.unshift({ id: MORTGAGE_CATEGORY_ID, label: `🏠 ${t.mortgage.title}` });
    }
    return [{ id: 'all', label: t.history.allCategories }, ...list];
  });

  const selectedName = $derived(
    options.find((o) => o.id === selected)?.label ?? t.history.allCategories,
  );

  $effect(() => {
    if (!options.some((o) => o.id === selected)) selected = 'all';
  });

  const series = $derived(monthlySeries(items, months, catArg));
  const trackedInRange = $derived(new Set(tracked.filter((m) => months.includes(m))));
  // Un mes sin gastos registrados es "sin datos" (salvo para ver solo la hipoteca).
  const hasData = (m: string) => selected === MORTGAGE_CATEGORY_ID || trackedInRange.has(m);

  const stats = $derived.by(() => {
    const vals = months.map((m, i) => ({ m, v: series[i]! })).filter((x) => hasData(x.m));
    if (vals.length === 0) return null;
    const sorted = [...vals].sort((a, b) => b.v - a.v);
    return {
      average: Math.round(vals.reduce((s, x) => s + x.v, 0) / vals.length),
      max: sorted[0]!,
      min: sorted.at(-1)!,
      total: vals.reduce((s, x) => s + x.v, 0),
    };
  });

  const season = $derived(seasonality(items, catArg));
  const extremes = $derived(seasonExtremes(season));

  const matrixMonths = $derived(months.filter((m) => trackedInRange.has(m)));
  const matrix = $derived.by(() => {
    const map = categoryMatrix(items, matrixMonths);
    const rows = [...map]
      .map(([id, values]) => {
        const info =
          id === MORTGAGE_CATEGORY_ID
            ? { name: t.mortgage.title, emoji: '🏠' }
            : (app.categoryById.get(id) ?? { name: '—', emoji: '❔' });
        return {
          id,
          name: info.name,
          emoji: info.emoji,
          values,
          total: values.reduce((a, b) => a + b, 0),
        };
      })
      .sort((a, b) => b.total - a.total);
    const colTotals = matrixMonths.map((_, i) => rows.reduce((s, r) => s + r.values[i]!, 0));
    return { rows, colTotals, total: colTotals.reduce((a, b) => a + b, 0) };
  });

  // ── Gráficas ──
  const euroTicks = (v: string | number) => `${Number(v).toLocaleString('es-ES')} €`;
  const scales = (stacked = false) => ({
    x: { stacked, grid: { display: false }, ticks: { color: token('--ink-faint') } },
    y: {
      stacked,
      beginAtZero: true,
      grid: { color: token('--border') },
      ticks: { color: token('--ink-faint'), callback: euroTicks },
    },
  });

  const monthlyChart = $derived.by((): ChartConfiguration => {
    void app.settings.theme;
    const accent = token('--accent');
    const faint = token('--border-strong');
    return {
      type: 'bar',
      data: {
        labels: months.map((m) => monthLabel(m)),
        datasets: [
          {
            label: selectedName,
            data: series.map((c, i) => (hasData(months[i]!) ? c / 100 : null)),
            backgroundColor: months.map((m) => (m === thisMonth ? accent : `${accent}99`)),
            borderColor: faint,
            borderRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: scales(),
        plugins: { legend: { display: false } },
      },
    };
  });

  const PALETTE = ['--ink-faint', '--warning', '--positive', '--danger', '--ink-soft'];

  const yoyChart = $derived.by((): ChartConfiguration => {
    void app.settings.theme;
    const tracked = new Set(trackedMonths(items));
    const years = [...new Set([...tracked].map((m) => Number(m.slice(0, 4))))].sort().slice(-5);
    return {
      type: 'line',
      data: {
        labels: CAL_MONTHS,
        datasets: years.map((year, idx) => {
          const isLast = idx === years.length - 1;
          const color = isLast ? token('--accent') : token(PALETTE[idx % PALETTE.length]!);
          return {
            label: String(year),
            data: CAL_MONTHS.map((_, i) => {
              const m = `${year}-${String(i + 1).padStart(2, '0')}`;
              if (!tracked.has(m)) return null;
              return monthlySeries(items, [m], catArg)[0]! / 100;
            }),
            borderColor: color,
            backgroundColor: color,
            borderWidth: isLast ? 3 : 2,
            tension: 0.25,
            pointRadius: 3,
            spanGaps: false,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: scales(),
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

  const seasonChart = $derived.by((): ChartConfiguration => {
    void app.settings.theme;
    const accent = token('--accent');
    const danger = token('--danger');
    const positive = token('--positive');
    return {
      type: 'bar',
      data: {
        labels: CAL_MONTHS,
        datasets: [
          {
            label: t.history.season,
            data: season.map((p) => (p.avgCents === null ? null : p.avgCents / 100)),
            backgroundColor: season.map((p) =>
              p === extremes.max ? danger : p === extremes.min ? positive : `${accent}99`,
            ),
            borderRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: scales(),
        plugins: { legend: { display: false } },
      },
    };
  });
</script>

<header class="view-header">
  <div>
    <h1>{t.history.title}</h1>
    <p class="subtitle">{t.history.subtitle}</p>
  </div>
</header>

{#if tracked.length === 0}
  <section class="card empty">
    <i class="fi fi-rr-chart-histogram big-icon" aria-hidden="true"></i>
    <p><strong>{t.history.empty}</strong></p>
    <small>{t.history.emptyHint}</small>
  </section>
{:else}
  <section class="card filters">
    <div class="field">
      <span class="label" id="hist-cat">{t.history.category}</span>
      <div class="chips" role="group" aria-labelledby="hist-cat">
        {#each options as o (o.id)}
          <button class="chip" aria-pressed={selected === o.id} onclick={() => (selected = o.id)}>
            {o.label}
          </button>
        {/each}
      </div>
    </div>
    <div class="field">
      <span class="label" id="hist-range">{t.history.range}</span>
      <div class="seg" role="tablist" aria-labelledby="hist-range">
        <button role="tab" aria-selected={range === '12'} onclick={() => (range = '12')}
          >{t.history.range12}</button
        >
        <button role="tab" aria-selected={range === '24'} onclick={() => (range = '24')}
          >{t.history.range24}</button
        >
        <button role="tab" aria-selected={range === 'all'} onclick={() => (range = 'all')}
          >{t.history.rangeAll}</button
        >
      </div>
    </div>
  </section>

  {#if stats}
    <div class="stats">
      <div class="card">
        <span class="mini-label">{t.history.stats.average}</span>
        <span class="mini-value num">{fmt(stats.average)}</span>
      </div>
      <div class="card">
        <span class="mini-label">{t.history.stats.max}</span>
        <span class="mini-value num">{fmt(stats.max.v)}</span>
        <span class="mini-hint">{monthLabel(stats.max.m, 'long')}</span>
      </div>
      <div class="card">
        <span class="mini-label">{t.history.stats.min}</span>
        <span class="mini-value num">{fmt(stats.min.v)}</span>
        <span class="mini-hint">{monthLabel(stats.min.m, 'long')}</span>
      </div>
      <div class="card">
        <span class="mini-label">{t.history.stats.total}</span>
        <span class="mini-value num">{fmt(stats.total)}</span>
      </div>
    </div>
  {/if}

  <section class="card">
    <h2>{t.history.monthly}</h2>
    <ChartCanvas config={monthlyChart} label={t.history.monthly} height={240} />
  </section>

  <div class="two-col">
    <section class="card">
      <h2>{t.history.season}</h2>
      <p class="card-note">{t.history.seasonHint}</p>
      {#if extremes.max && extremes.min}
        <p class="insight">
          {t.history.seasonMax(
            selectedName,
            CAL_MONTHS_LONG[extremes.max.calMonth - 1]!,
            fmt(extremes.max.avgCents!),
          )}
          {t.history.seasonMin(
            CAL_MONTHS_LONG[extremes.min.calMonth - 1]!,
            fmt(extremes.min.avgCents!),
          )}
        </p>
        <ChartCanvas config={seasonChart} label={t.history.season} height={220} />
      {:else}
        <p class="empty">{t.history.seasonNeedData}</p>
      {/if}
    </section>

    <section class="card">
      <h2>{t.history.yoy}</h2>
      <p class="card-note">{t.history.yoyHint}</p>
      <ChartCanvas config={yoyChart} label={t.history.yoy} height={240} />
    </section>
  </div>

  <section class="card">
    <h2>{t.history.matrix}</h2>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">{t.forms.category}</th>
            {#each matrixMonths as m (m)}
              <th scope="col">{monthLabel(m)}</th>
            {/each}
            <th scope="col">{t.history.matrixTotal}</th>
          </tr>
        </thead>
        <tbody>
          {#each matrix.rows as r (r.id)}
            <tr>
              <th scope="row"><span aria-hidden="true">{r.emoji}</span> {r.name}</th>
              {#each r.values as v, i (i)}
                <td class:muted={v === 0}>{v === 0 ? '—' : formatCentsCompact(v, currency)}</td>
              {/each}
              <td><strong>{formatCentsCompact(r.total, currency)}</strong></td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td>{t.history.matrixTotal}</td>
            {#each matrix.colTotals as v, i (i)}
              <td>{formatCentsCompact(v, currency)}</td>
            {/each}
            <td>{formatCentsCompact(matrix.total, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>
{/if}

<style>
  .big-icon {
    font-size: 34px;
    color: var(--accent);
    display: block;
    margin-bottom: 8px;
  }
  .filters {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .label {
    font-size: 13px;
    font-weight: 650;
    color: var(--ink-soft);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }
  .stats .card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
  }
  .insight {
    font-size: 14px;
    font-weight: 600;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    margin: 8px 0 12px;
  }
  .data-table tbody th {
    font-weight: 600;
    text-align: left;
  }
</style>
