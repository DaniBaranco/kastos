// Registro mínimo de Chart.js (tree-shaking) y defaults acordes al tema.

import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  LineController,
  BarController,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
  Legend,
);

Chart.defaults.font.family =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
Chart.defaults.font.size = 11;

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  Chart.defaults.animation = false;
}

/** Lee un design token CSS (para que las gráficas sigan al tema). */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export { Chart };
