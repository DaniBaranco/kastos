<script lang="ts">
  interface Props {
    label: string;
    value: string;
    id: string;
    symbol?: string;
    placeholder?: string;
    hint?: string;
  }

  let {
    label,
    value = $bindable(),
    id,
    symbol = '€',
    placeholder = '0,00',
    hint,
  }: Props = $props();
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="wrap">
    <input
      {id}
      class="input amount"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      {placeholder}
      bind:value
    />
    <span class="symbol" aria-hidden="true">{symbol}</span>
  </div>
  {#if hint}<small class="muted">{hint}</small>{/if}
</div>

<style>
  .wrap {
    position: relative;
  }
  .amount {
    padding-right: 34px;
    font-size: 19px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .symbol {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-faint);
    font-weight: 650;
    pointer-events: none;
  }
  small {
    font-size: 12px;
  }
</style>
