<script lang="ts">
  import { t } from '../i18n/es';
  import { app } from '../stores/app.svelte';
  import { formatCents } from '../core/money';
  import { currentMonthKey } from '../core/dates';
  import { savingsRateCents } from '../core/savings';
  import { aggregateGoals, analyzeGoal, type GoalAnalysis } from '../core/goals';
  import GoalForm from '../components/GoalForm.svelte';
  import SavingsEntryForm from '../components/SavingsEntryForm.svelte';
  import type { SavingsGoal } from '../core/types';

  let formOpen = $state(false);
  let editing = $state<SavingsGoal | null>(null);
  let contributeGoalId = $state<string | null>(null);

  const month = currentMonthKey();
  const currency = $derived(app.settings.currency);
  const rate = $derived(savingsRateCents(app.savingsEntries, month, 6));

  // Referencia: el patrón activo (compromiso) o, si no hay, el ritmo real.
  const reference = $derived(app.activePattern?.monthlyCents ?? rate);
  const referenceLabel = $derived(
    app.activePattern ? t.goals.referencePattern : t.goals.referenceRate,
  );

  const activeGoals = $derived(app.goals.filter((g) => !g.archived));
  const analyses = $derived(
    new Map(activeGoals.map((g) => [g.id, analyzeGoal(g, app.savingsEntries, month, reference)])),
  );
  const pending = $derived(
    [...analyses.values()].filter((a) => a.state !== 'done' && a.quotaCents !== null),
  );
  const aggregate = $derived(aggregateGoals(pending, reference));

  const badgeClass: Record<string, string> = {
    done: 'ok',
    'on-track': 'ok',
    tight: 'warn',
    unreachable: 'bad',
  };
  // Iconos Flaticon por estado (el color nunca va solo).
  const badgeIcon: Record<string, string> = {
    done: 'fi-rr-check',
    'on-track': 'fi-rr-check',
    tight: 'fi-rr-arrow-small-right',
    unreachable: 'fi-rr-exclamation',
  };

  function pct(goal: SavingsGoal, a: GoalAnalysis): number {
    return Math.min(100, Math.max(0, (a.contributedCents / goal.targetCents) * 100));
  }
</script>

<header class="view-header">
  <div>
    <h1>{t.goals.title}</h1>
    <p class="subtitle">{t.goals.subtitle}</p>
  </div>
  <button
    class="btn btn-primary small"
    onclick={() => {
      editing = null;
      formOpen = true;
    }}><i class="fi fi-rr-plus" aria-hidden="true"></i> {t.actions.newM}</button
  >
</header>

{#if pending.length > 0}
  <section class="card aggregate">
    {#if aggregate.overCommitted}
      <p class="badge bad">
        <i class="fi fi-rr-exclamation" aria-hidden="true"></i>
        {t.goals.state.unreachable}
      </p>
      <p class="agg-text">
        {t.goals.aggregateWarn(
          formatCents(aggregate.totalQuotaCents, currency),
          formatCents(Math.max(0, reference), currency),
        )}
      </p>
    {:else}
      <p class="agg-text">
        <i class="fi fi-rr-check" aria-hidden="true"></i>
        {t.goals.aggregateOk(formatCents(aggregate.totalQuotaCents, currency))}
      </p>
    {/if}
    <p class="agg-ref muted">({referenceLabel})</p>
  </section>
{/if}

{#if activeGoals.length === 0}
  <section class="card">
    <p class="empty">
      {t.goals.empty}
      <small>{t.goals.emptyHint}</small>
    </p>
  </section>
{:else}
  <div class="goals-grid">
    {#each activeGoals as goal (goal.id)}
      {@const a = analyses.get(goal.id)!}
      <section class="card goal">
        <div class="goal-head">
          <span class="row-emoji" aria-hidden="true">{goal.emoji}</span>
          <div class="goal-title">
            <h2>{goal.name}</h2>
            <p class="row-sub">
              <i class="fi fi-rr-calendar" aria-hidden="true"></i>
              {new Date(goal.deadline + 'T00:00').toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {#if a.state !== 'done'}
                · {a.monthsRemaining > 0
                  ? t.goals.monthsLeft(a.monthsRemaining)
                  : t.goals.deadlinePassed}
              {/if}
            </p>
          </div>
          <span class="badge {badgeClass[a.state]}" title={t.goals.stateHint[a.state]}>
            <i class="fi {badgeIcon[a.state]}" aria-hidden="true"></i>
            {t.goals.state[a.state]}
          </span>
        </div>

        <div class="goal-amounts num">
          <strong>{formatCents(a.contributedCents, currency)}</strong>
          <span class="muted">{t.goals.of} {formatCents(goal.targetCents, currency)}</span>
        </div>
        <div class="progress">
          <div
            class={a.state === 'done' || a.state === 'on-track'
              ? 'fill-ok'
              : a.state === 'tight'
                ? 'fill-warn'
                : 'fill-bad'}
            style:width={`${pct(goal, a)}%`}
          ></div>
        </div>

        {#if a.quotaCents !== null}
          <p class="quota">
            {t.goals.quota}:
            <strong class="num">{formatCents(a.quotaCents, currency)}{t.goals.perMonth}</strong>
          </p>
          <p class="card-note">{t.goals.stateHint[a.state]}</p>
        {/if}
        {#if a.realisticMonthLabel}
          <p class="card-note realistic">
            <i class="fi fi-rr-bulb" aria-hidden="true"></i>
            {t.goals.realisticDate(a.realisticMonthLabel)}
          </p>
        {/if}

        <div class="goal-actions">
          {#if a.state !== 'done'}
            <button class="btn btn-primary small" onclick={() => (contributeGoalId = goal.id)}
              ><i class="fi fi-rr-plus" aria-hidden="true"></i> {t.goals.contribute}</button
            >
          {/if}
          <button
            class="btn btn-ghost small"
            onclick={() => {
              editing = goal;
              formOpen = true;
            }}>{t.actions.edit}</button
          >
        </div>
      </section>
    {/each}
  </div>
{/if}

<GoalForm
  open={formOpen}
  goal={editing}
  onclose={() => {
    formOpen = false;
    editing = null;
  }}
/>
<SavingsEntryForm
  open={contributeGoalId !== null}
  goalId={contributeGoalId ?? undefined}
  onclose={() => (contributeGoalId = null)}
/>

<style>
  .aggregate {
    margin-bottom: 14px;
  }
  .agg-text {
    font-size: 13.5px;
    color: var(--ink-soft);
    margin-top: 6px;
  }
  .agg-ref {
    font-size: 12px;
    margin-top: 4px;
  }
  .goals-grid {
    display: grid;
    gap: 14px;
  }
  @media (min-width: 700px) {
    .goals-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .goal-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 12px;
  }
  .goal-title {
    flex: 1;
    min-width: 0;
  }
  .goal-title h2 {
    margin-bottom: 0;
  }
  .goal-amounts {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
  }
  .goal-amounts strong {
    font-size: 20px;
    font-weight: 700;
  }
  .quota {
    margin-top: 10px;
    font-size: 13.5px;
  }
  .quota strong {
    color: var(--accent);
  }
  .realistic {
    margin-top: 6px;
  }
  .goal-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }
</style>
