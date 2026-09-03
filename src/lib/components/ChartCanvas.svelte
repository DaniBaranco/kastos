<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChartConfiguration } from 'chart.js';
  import { Chart } from '../charts/setup';

  interface Props {
    config: ChartConfiguration;
    /** Descripción accesible de la gráfica. */
    label: string;
    height?: number;
  }

  let { config, label, height = 210 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    return () => {
      chart?.destroy();
      chart = null;
    };
  });

  $effect(() => {
    const cfg = config;
    if (!chart) {
      chart = new Chart(canvas, cfg);
    } else {
      chart.data = cfg.data;
      if (cfg.options) chart.options = cfg.options;
      chart.update();
    }
  });
</script>

<div class="chart-box" style:height="{height}px" role="img" aria-label={label}>
  <canvas bind:this={canvas}></canvas>
</div>
