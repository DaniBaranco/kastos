// charts.js — Gestión de gráficas con Chart.js.
// Exporta funciones para crear/actualizar los dos gráficos del dashboard.

// Paleta de colores para el donut (se reutiliza en categorías).
// Basada en los colores de sistema de Apple (versión dark).
export const PALETTE = [
  '#30d158', '#bf5af2', '#0a84ff', '#ff453a',
  '#ffd60a', '#ff9f0a', '#64d2ff', '#ff375f',
  '#66d4cf', '#5e5ce6', '#ac8e68', '#98989d',
];

// Colores compartidos de las gráficas (coherentes con css/styles.css)
const C = {
  green:   '#30d158',
  red:     '#ff453a',
  grid:    '#2c2c2e',
  ticks:   '#8e8e93',
  tooltipBg:     '#2c2c2e',
  tooltipBorder: '#3a3a3c',
  tooltipTitle:  '#a1a1a6',
  cardBg:  '#1c1c1e',
};

let chartEvolution = null;
let chartDonut     = null;

const CHART_DEFAULTS = {
  animation: { duration: 500 },
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
};

// ── Gráfica de barras: ingresos vs gastos (últimos 6 meses) ──────────────

export function renderEvolutionChart(data) {
  // data: [{ label: 'Mar', income: 2000, expense: 1500 }, ...]
  const ctx = document.getElementById('chart-evolution');
  if (!ctx) return;

  const labels   = data.map((d) => d.label);
  const incomes  = data.map((d) => d.income);
  const expenses = data.map((d) => d.expense);

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incomes,
          backgroundColor: `${C.green}66`,
          borderColor:     C.green,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Gastos',
          data: expenses,
          backgroundColor: `${C.red}66`,
          borderColor:     C.red,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid:  { color: C.grid, drawBorder: false },
          ticks: { color: C.ticks, font: { size: 11, family: 'Inter' } },
        },
        y: {
          grid:  { color: C.grid, drawBorder: false },
          ticks: {
            color: C.ticks,
            font: { size: 11, family: 'Inter' },
            callback: (v) => '€' + v.toLocaleString('es'),
          },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: C.tooltipBg,
          borderColor: C.tooltipBorder,
          borderWidth: 1,
          titleColor: C.tooltipTitle,
          bodyColor: '#f5f5f7',
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  };

  if (chartEvolution) {
    chartEvolution.data.labels            = labels;
    chartEvolution.data.datasets[0].data  = incomes;
    chartEvolution.data.datasets[1].data  = expenses;
    chartEvolution.update();
  } else {
    chartEvolution = new Chart(ctx, config);
  }
}

// ── Gráfica de dona: distribución de gastos por categoría ────────────────

export function renderDonutChart(data, legendEl) {
  // data: [{ label: 'Alimentación', value: 350, color: '#00c853' }, ...]
  const ctx = document.getElementById('chart-donut');
  if (!ctx) return;

  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);
  const colors = data.map((d) => d.color);
  const total  = values.reduce((a, b) => a + b, 0);

  const config = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: C.cardBg,
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: C.tooltipBg,
          borderColor: C.tooltipBorder,
          borderWidth: 1,
          titleColor: C.tooltipTitle,
          bodyColor: '#f5f5f7',
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  };

  if (chartDonut) {
    chartDonut.data.labels                     = labels;
    chartDonut.data.datasets[0].data           = values;
    chartDonut.data.datasets[0].backgroundColor = colors;
    chartDonut.update();
  } else {
    chartDonut = new Chart(ctx, config);
  }

  // Leyenda manual
  if (legendEl) {
    legendEl.innerHTML = data.length === 0
      ? '<span style="color:var(--ink-muted);font-size:13px">Sin gastos este mes</span>'
      : data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return `<div class="legend-item">
            <span class="legend-dot" style="background:${d.color}"></span>
            <span class="legend-label">${d.label}</span>
            <span class="legend-pct">${pct}%</span>
          </div>`;
        }).join('');
  }
}

// ── Gráfica de línea: ahorro acumulado (últimos 6 meses) ─────────────────

let chartSavings = null;

export function renderSavingsChart(data) {
  // data: [{ label: 'Mar', savings: 450 }, ...]
  const ctx = document.getElementById('chart-savings');
  if (!ctx) return;

  const labels  = data.map((d) => d.label);
  const savings = data.map((d) => d.savings);

  // Acumular: cada mes suma el anterior
  let acc = 0;
  const accumulated = savings.map((s) => { acc += s; return Math.max(0, acc); });

  const positiveColor = C.green;
  const negativeColor = C.red;
  const hasNegative   = accumulated.some((v) => v < 0);

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ahorro acumulado',
        data: accumulated,
        borderColor: positiveColor,
        backgroundColor: `${positiveColor}18`,
        borderWidth: 2.5,
        pointBackgroundColor: accumulated.map((v) => v < 0 ? negativeColor : positiveColor),
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid:  { color: C.grid, drawBorder: false },
          ticks: { color: C.ticks, font: { size: 11, family: 'Inter' } },
        },
        y: {
          grid:  { color: C.grid, drawBorder: false },
          ticks: {
            color: C.ticks,
            font: { size: 11, family: 'Inter' },
            callback: (v) => '€' + v.toLocaleString('es'),
          },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: C.tooltipBg,
          borderColor: C.tooltipBorder,
          borderWidth: 1,
          titleColor: C.tooltipTitle,
          bodyColor: '#f5f5f7',
          padding: 10,
          callbacks: {
            label: (ctx) => ` Ahorro acumulado: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  };

  if (chartSavings) {
    chartSavings.data.labels              = labels;
    chartSavings.data.datasets[0].data    = accumulated;
    chartSavings.data.datasets[0].pointBackgroundColor = accumulated.map(
      (v) => v < 0 ? negativeColor : positiveColor
    );
    chartSavings.update();
  } else {
    chartSavings = new Chart(ctx, config);
  }
}



// ── Gráfica de proyección: calculadora de interés compuesto ──────────────

let chartProjection = null;

export function renderProjectionChart(points) {
  // points: [{ label: 'Año 1', total: 2340, contributed: 2200 }, ...]
  const ctx = document.getElementById('chart-projection');
  if (!ctx) return;

  const labels      = points.map((p) => p.label);
  const totals      = points.map((p) => Math.round(p.total));
  const contributed = points.map((p) => Math.round(p.contributed));

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total con intereses',
          data: totals,
          borderColor: C.green,
          backgroundColor: `${C.green}18`,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Aportado por ti',
          data: contributed,
          borderColor: C.ticks,
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid:  { color: C.grid, drawBorder: false },
          ticks: {
            color: C.ticks,
            font: { size: 10, family: 'Inter' },
            maxTicksLimit: 6,
          },
        },
        y: {
          grid:  { color: C.grid, drawBorder: false },
          ticks: {
            color: C.ticks,
            font: { size: 10, family: 'Inter' },
            callback: (v) => '€' + v.toLocaleString('es'),
          },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: C.tooltipBg,
          borderColor: C.tooltipBorder,
          borderWidth: 1,
          titleColor: C.tooltipTitle,
          bodyColor: '#f5f5f7',
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  };

  if (chartProjection) {
    chartProjection.data.labels           = labels;
    chartProjection.data.datasets[0].data = totals;
    chartProjection.data.datasets[1].data = contributed;
    chartProjection.update();
  } else {
    chartProjection = new Chart(ctx, config);
  }
}

export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount);
}
