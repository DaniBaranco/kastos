// La bolsa de ahorro: totales, serie del acumulado y ritmo real.
//
// Las entradas marcadas `initial` (ahorro que el usuario ya tenía) SUMAN a la
// bolsa y a la serie del acumulado, pero quedan FUERA del "ahorro del mes" y
// del ritmo: el seguimiento mensual de cualquier usuario parte de 0.

import type { SavingsEntry } from './types';
import { addMonths, monthRange } from './dates';

function sumInMonth(entries: SavingsEntry[], month: string, includeInitial: boolean): number {
  let total = 0;
  for (const e of entries) {
    if (e.month !== month) continue;
    if (!includeInitial && e.initial === true) continue;
    total += e.amountCents;
  }
  return total;
}

/** Aportación neta del mes (sin contar el punto de partida `initial`). */
export function savedInMonthCents(entries: SavingsEntry[], month: string): number {
  return sumInMonth(entries, month, false);
}

/** Ahorro acumulado total (punto de partida incluido); filtros opcionales. */
export function totalSavedCents(
  entries: SavingsEntry[],
  opts: { toMonth?: string; goalId?: string } = {},
): number {
  let total = 0;
  for (const e of entries) {
    if (opts.toMonth !== undefined && e.month > opts.toMonth) continue;
    if (opts.goalId !== undefined && e.goalId !== opts.goalId) continue;
    total += e.amountCents;
  }
  return total;
}

/** Serie del acumulado mes a mes en [from..to] (todo incluido, también `initial`). */
export function accumulatedSeries(
  entries: SavingsEntry[],
  from: string,
  to: string,
): { month: string; accumulatedCents: number }[] {
  let acc = totalSavedCents(entries, { toMonth: addMonths(from, -1) });
  return monthRange(from, to).map((month) => {
    acc += sumInMonth(entries, month, true);
    return { month, accumulatedCents: acc };
  });
}

/**
 * Racha: meses consecutivos cumpliendo el patrón (aportación neta del mes,
 * sin `initial`, ≥ importe del patrón).
 *
 * Reglas:
 *  - El mes en curso cuenta si ya está cumplido, pero NO rompe la racha si
 *    aún no lo está (el mes no ha terminado).
 *  - Se evalúa contra el patrón ACTUAL también hacia atrás (no se guarda
 *    histórico de patrones; limitación asumida y documentada).
 */
export function fulfilledStreak(
  entries: SavingsEntry[],
  patternMonthlyCents: number,
  currentMonth: string,
): number {
  if (patternMonthlyCents <= 0) return 0;
  let streak = 0;
  let month = currentMonth;
  if (savedInMonthCents(entries, month) < patternMonthlyCents) {
    month = addMonths(month, -1); // el mes en curso sin cumplir no rompe la racha
  }
  // Tope defensivo de 50 años para no iterar sin fin.
  for (let i = 0; i < 600; i++) {
    if (savedInMonthCents(entries, month) < patternMonthlyCents) break;
    streak++;
    month = addMonths(month, -1);
  }
  return streak;
}

/**
 * Ritmo de ahorro real: media móvil de las aportaciones netas (sin `initial`)
 * de los últimos `windowMonths` meses TERMINADOS en `endMonth` (inclusive).
 * Los meses sin aportaciones cuentan como 0, pero si el histórico del usuario
 * es más corto que la ventana, se divide solo por los meses con histórico
 * (desde la primera aportación no-initial). Sin aportaciones → 0.
 */
export function savingsRateCents(
  entries: SavingsEntry[],
  endMonth: string,
  windowMonths = 6,
): number {
  const flowEntries = entries.filter((e) => e.initial !== true);
  if (flowEntries.length === 0) return 0;
  let firstMonth = flowEntries[0]!.month;
  for (const e of flowEntries) if (e.month < firstMonth) firstMonth = e.month;
  if (firstMonth > endMonth) return 0;

  const windowStart = addMonths(endMonth, -(windowMonths - 1));
  const from = firstMonth > windowStart ? firstMonth : windowStart;
  const months = monthRange(from, endMonth);
  if (months.length === 0) return 0;

  let total = 0;
  for (const month of months) total += sumInMonth(flowEntries, month, false);
  return Math.round(total / months.length);
}
