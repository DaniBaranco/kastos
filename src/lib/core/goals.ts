// Objetivos de ahorro: cuota mensual necesaria, estado y fecha realista,
// medidos contra la referencia del usuario (su patrón activo o, en su
// defecto, su ritmo real de ahorro).

import type { SavingsEntry, SavingsGoal } from './types';
import { addMonths, monthLabel, remainingMonths } from './dates';
import { totalSavedCents } from './savings';

export type GoalState = 'done' | 'on-track' | 'tight' | 'unreachable';

export interface GoalAnalysis {
  goalId: string;
  contributedCents: number;
  remainingCents: number;
  /** Periodos de aportación hasta el deadline (mes actual incluido). */
  monthsRemaining: number;
  /** Cuota mensual necesaria (redondeo al alza al céntimo). null si done o sin plazo. */
  quotaCents: number | null;
  state: GoalState;
  /** Si no llega a tiempo: mes realista de consecución con la referencia (YYYY-MM). */
  realisticMonth: string | null;
  realisticMonthLabel: string | null;
}

/** Total aportado a un objetivo (SavingsEntry con goalId). */
export function contributedToGoalCents(entries: SavingsEntry[], goalId: string): number {
  return totalSavedCents(entries, { goalId });
}

/** Margen del estado "ajustado": hasta un 25 % por encima de la referencia. */
const TIGHT_FACTOR = 1.25;

/**
 * Análisis de un objetivo contra `referenceCents` (patrón activo o ritmo real):
 * - `done`: objetivo cubierto.
 * - `on-track`: cuota ≤ referencia (tu plan de ahorro cubre la cuota).
 * - `tight`: cuota ≤ referencia × 1,25 (llegas apretando un poco el patrón).
 * - `unreachable`: cuota mayor, o deadline pasado sin completar.
 */
export function analyzeGoal(
  goal: SavingsGoal,
  entries: SavingsEntry[],
  currentMonth: string,
  referenceCents: number,
): GoalAnalysis {
  const contributedCents = contributedToGoalCents(entries, goal.id);
  const remainingCents = Math.max(0, goal.targetCents - contributedCents);
  const monthsRemaining = remainingMonths(currentMonth, goal.deadline);

  const base = { goalId: goal.id, contributedCents, remainingCents, monthsRemaining };

  if (remainingCents === 0) {
    return {
      ...base,
      quotaCents: null,
      state: 'done',
      realisticMonth: null,
      realisticMonthLabel: null,
    };
  }

  const realistic = realisticMonthFor(remainingCents, referenceCents, currentMonth);

  if (monthsRemaining === 0) {
    // Deadline pasado sin completar.
    return {
      ...base,
      quotaCents: null,
      state: 'unreachable',
      realisticMonth: realistic,
      realisticMonthLabel: realistic ? monthLabel(realistic, 'long') : null,
    };
  }

  const quotaCents = Math.ceil(remainingCents / monthsRemaining);
  let state: GoalState;
  if (quotaCents <= referenceCents) state = 'on-track';
  else if (referenceCents > 0 && quotaCents <= Math.round(referenceCents * TIGHT_FACTOR))
    state = 'tight';
  else state = 'unreachable';

  const showRealistic = state === 'unreachable';
  return {
    ...base,
    quotaCents,
    state,
    realisticMonth: showRealistic ? realistic : null,
    realisticMonthLabel: showRealistic && realistic ? monthLabel(realistic, 'long') : null,
  };
}

/** Mes (YYYY-MM) en que se alcanzaría el objetivo a la referencia dada; null si ≤ 0. */
export function realisticMonthFor(
  remainingCents: number,
  referenceCents: number,
  currentMonth: string,
): string | null {
  if (referenceCents <= 0) return null;
  const months = Math.ceil(remainingCents / referenceCents);
  return addMonths(currentMonth, months);
}

export interface GoalsAggregate {
  totalQuotaCents: number;
  referenceCents: number;
  /** true si la suma de cuotas de los objetivos activos supera la referencia. */
  overCommitted: boolean;
}

/** Vista agregada: ¿caben todos los objetivos activos en el patrón de ahorro? */
export function aggregateGoals(analyses: GoalAnalysis[], referenceCents: number): GoalsAggregate {
  let totalQuotaCents = 0;
  for (const a of analyses) totalQuotaCents += a.quotaCents ?? 0;
  return {
    totalQuotaCents,
    referenceCents,
    overCommitted: totalQuotaCents > Math.max(0, referenceCents),
  };
}
