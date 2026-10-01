// Motor de gastos del hogar: control mes a mes, comparativas e histórico.
// Trabaja sobre "partidas" genéricas (gastos reales + cuotas de hipoteca
// virtuales) para que el histórico pueda incluir la hipoteca como una
// categoría más sin persistirla como gasto.

import type { Expense, Mortgage } from './types';
import type { MortgageSchedule } from './mortgage';
import { addMonths, monthRange } from './dates';

/** Id de la categoría virtual que agrupa las cuotas hipotecarias. */
export const MORTGAGE_CATEGORY_ID = '__mortgage__';

export interface AmountItem {
  month: string;
  categoryId: string;
  amountCents: number;
  /** Partida derivada (cuota de hipoteca), no introducida por el usuario. */
  virtual?: boolean;
}

/** Cuotas hipotecarias como partidas virtuales de los meses [from..to]. */
export function mortgageItems(
  mortgages: ReadonlyArray<{ mortgage: Mortgage; schedule: MortgageSchedule }>,
  from: string,
  to: string,
): AmountItem[] {
  const out: AmountItem[] = [];
  for (const { mortgage, schedule } of mortgages) {
    if (!mortgage.includeInExpenses) continue;
    for (const r of schedule.rows) {
      if (r.month < from || r.month > to) continue;
      out.push({
        month: r.month,
        categoryId: MORTGAGE_CATEGORY_ID,
        amountCents: r.paymentCents,
        virtual: true,
      });
    }
  }
  return out;
}

export function toItems(expenses: readonly Expense[]): AmountItem[] {
  return expenses.map((e) => ({
    month: e.month,
    categoryId: e.categoryId,
    amountCents: e.amountCents,
  }));
}

/** Meses con al menos un gasto real registrado, ordenados. */
export function trackedMonths(items: readonly AmountItem[]): string[] {
  return [...new Set(items.filter((i) => !i.virtual).map((i) => i.month))].sort();
}

/** Total de un mes (opcionalmente de una categoría). */
export function monthTotalCents(
  items: readonly AmountItem[],
  month: string,
  categoryId?: string,
): number {
  let sum = 0;
  for (const i of items) {
    if (i.month === month && (categoryId === undefined || i.categoryId === categoryId)) {
      sum += i.amountCents;
    }
  }
  return sum;
}

/** Totales por categoría de un mes, de mayor a menor. */
export function categoryTotals(
  items: readonly AmountItem[],
  month: string,
): { categoryId: string; amountCents: number }[] {
  const map = new Map<string, number>();
  for (const i of items) {
    if (i.month !== month) continue;
    map.set(i.categoryId, (map.get(i.categoryId) ?? 0) + i.amountCents);
  }
  return [...map]
    .map(([categoryId, amountCents]) => ({ categoryId, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

/** Serie mensual de totales para los meses dados. */
export function monthlySeries(
  items: readonly AmountItem[],
  months: readonly string[],
  categoryId?: string,
): number[] {
  const map = new Map<string, number>();
  for (const i of items) {
    if (categoryId !== undefined && i.categoryId !== categoryId) continue;
    map.set(i.month, (map.get(i.month) ?? 0) + i.amountCents);
  }
  return months.map((m) => map.get(m) ?? 0);
}

export interface MonthComparison {
  currentCents: number;
  previousCents: number | null;
  lastYearCents: number | null;
}

/**
 * Compara un mes con el anterior y con el mismo mes del año pasado.
 * Un mes sin gastos reales registrados se considera "sin datos" (null), para
 * no comparar contra meses en los que el usuario aún no usaba la app.
 */
export function compareMonth(
  items: readonly AmountItem[],
  month: string,
  categoryId?: string,
): MonthComparison {
  const tracked = new Set(trackedMonths(items));
  const valueOf = (m: string) => (tracked.has(m) ? monthTotalCents(items, m, categoryId) : null);
  return {
    currentCents: monthTotalCents(items, month, categoryId),
    previousCents: valueOf(addMonths(month, -1)),
    lastYearCents: valueOf(addMonths(month, -12)),
  };
}

/** Variación porcentual (null si no hay base con la que comparar). */
export function pctChange(current: number, base: number | null): number | null {
  if (base === null || base === 0) return null;
  return ((current - base) / Math.abs(base)) * 100;
}

export interface SeasonPoint {
  /** 1–12 */
  calMonth: number;
  /** Media de ese mes natural entre los años con datos (null si no hay). */
  avgCents: number | null;
  samples: number;
}

/**
 * Estacionalidad: media de cada mes natural (ene…dic) a lo largo de los años
 * registrados. Solo cuentan los meses con datos reales, así un mes sin factura
 * de gas en un año con registros cuenta como 0, pero un mes anterior a empezar
 * a usar la app no rebaja la media.
 */
export function seasonality(items: readonly AmountItem[], categoryId?: string): SeasonPoint[] {
  const tracked = trackedMonths(items);
  const sums = Array<number>(12).fill(0);
  const counts = Array<number>(12).fill(0);
  for (const m of tracked) {
    const idx = Number(m.slice(5, 7)) - 1;
    sums[idx]! += monthTotalCents(items, m, categoryId);
    counts[idx]! += 1;
  }
  return sums.map((s, idx) => ({
    calMonth: idx + 1,
    avgCents: counts[idx]! > 0 ? Math.round(s / counts[idx]!) : null,
    samples: counts[idx]!,
  }));
}

/** Meses naturales más caros y más baratos según la estacionalidad. */
export function seasonExtremes(points: readonly SeasonPoint[]): {
  max: SeasonPoint | null;
  min: SeasonPoint | null;
} {
  const withData = points.filter((p) => p.avgCents !== null);
  if (withData.length < 2) return { max: null, min: null };
  const sorted = [...withData].sort((a, b) => b.avgCents! - a.avgCents!);
  return { max: sorted[0]!, min: sorted.at(-1)! };
}

/** Comparativa interanual: por cada año con datos, 12 valores (null = sin datos). */
export function yearOverYear(
  items: readonly AmountItem[],
  categoryId?: string,
): { year: number; values: (number | null)[] }[] {
  const tracked = new Set(trackedMonths(items));
  const years = [...new Set([...tracked].map((m) => Number(m.slice(0, 4))))].sort();
  return years.map((year) => ({
    year,
    values: Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`;
      return tracked.has(m) ? monthTotalCents(items, m, categoryId) : null;
    }),
  }));
}

/** Matriz categoría × mes para la tabla del histórico. */
export function categoryMatrix(
  items: readonly AmountItem[],
  months: readonly string[],
): Map<string, number[]> {
  const index = new Map(months.map((m, i) => [m, i]));
  const out = new Map<string, number[]>();
  for (const it of items) {
    const i = index.get(it.month);
    if (i === undefined) continue;
    let row = out.get(it.categoryId);
    if (!row) {
      row = Array<number>(months.length).fill(0);
      out.set(it.categoryId, row);
    }
    row[i]! += it.amountCents;
  }
  return out;
}

/** Media mensual de los meses con datos dentro de un rango. */
export function averageMonthlyCents(
  items: readonly AmountItem[],
  from: string,
  to: string,
  categoryId?: string,
): number | null {
  const tracked = new Set(trackedMonths(items));
  const months = monthRange(from, to).filter((m) => tracked.has(m));
  if (months.length === 0) return null;
  const total = months.reduce((s, m) => s + monthTotalCents(items, m, categoryId), 0);
  return Math.round(total / months.length);
}

/** Copia los gastos de un mes a otro (para meses con gastos fijos parecidos). */
export function copyMonthExpenses(
  expenses: readonly Expense[],
  from: string,
  to: string,
  deps: { makeId: () => string; now: Date },
): Expense[] {
  return expenses
    .filter((e) => e.month === from)
    .map((e) => ({
      id: deps.makeId(),
      month: to,
      categoryId: e.categoryId,
      amountCents: e.amountCents,
      note: e.note,
      createdAt: deps.now.toISOString(),
    }));
}
