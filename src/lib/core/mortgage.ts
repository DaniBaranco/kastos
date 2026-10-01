// Motor de préstamos hipotecarios: sistema francés (cuota constante) con
// revisiones de tipo y amortizaciones anticipadas.
//
// Cuota: A = B·i / (1 − (1+i)^−n), con i = TIN/12 y n = cuotas pendientes.
// Cada mes: interés = round(B·i); capital = A − interés; la última cuota se
// ajusta para dejar el saldo exactamente a 0 (céntimos enteros, sin deriva).

import type { Mortgage, Prepayment } from './types';
import { addMonths, monthsBetween } from './dates';

export interface ScheduleRow {
  /** Número de cuota (1-based). */
  n: number;
  month: string;
  ratePct: number;
  /** Cuota ordinaria (intereses + capital). */
  paymentCents: number;
  interestCents: number;
  principalCents: number;
  /** Amortización anticipada aplicada tras la cuota de este mes. */
  extraCents: number;
  /** Capital pendiente tras la cuota y la amortización extra. */
  balanceCents: number;
}

export interface MortgageSchedule {
  rows: ScheduleRow[];
  initialPaymentCents: number;
  totalInterestCents: number;
  totalExtraCents: number;
  /** Todo lo que se paga: cuotas + amortizaciones anticipadas. */
  totalPaidCents: number;
  endMonth: string;
}

/** Cuota mensual para amortizar `balanceCents` en `n` cuotas al TIN dado. */
export function monthlyPaymentCents(
  balanceCents: number,
  annualRatePct: number,
  n: number,
): number {
  if (balanceCents <= 0) return 0;
  if (n <= 1) return Math.round(balanceCents * (1 + Math.max(0, annualRatePct) / 1200));
  const i = Math.max(0, annualRatePct) / 1200;
  if (i === 0) return Math.ceil(balanceCents / n);
  return Math.round((balanceCents * i) / (1 - (1 + i) ** -n));
}

/** Cuotas necesarias para amortizar `balanceCents` pagando `paymentCents`. */
export function paymentsToRepay(
  balanceCents: number,
  annualRatePct: number,
  paymentCents: number,
): number {
  if (balanceCents <= 0) return 0;
  const i = Math.max(0, annualRatePct) / 1200;
  if (i === 0) return Math.ceil(balanceCents / paymentCents);
  const ratio = (balanceCents * i) / paymentCents;
  if (ratio >= 1) return Number.POSITIVE_INFINITY;
  return Math.ceil(-Math.log(1 - ratio) / Math.log(1 + i) - 1e-9);
}

/** TIN vigente en un mes: la última revisión con fromMonth ≤ mes, o el inicial. */
export function rateForMonth(m: Pick<Mortgage, 'annualRatePct' | 'rateChanges'>, month: string) {
  let rate = m.annualRatePct;
  let best = '';
  for (const c of m.rateChanges) {
    if (c.fromMonth <= month && c.fromMonth >= best) {
      best = c.fromMonth;
      rate = c.annualRatePct;
    }
  }
  return rate;
}

export function buildSchedule(m: Mortgage): MortgageSchedule {
  const rows: ScheduleRow[] = [];
  let balance = Math.max(0, m.principalCents);
  let remaining = Math.max(1, Math.floor(m.termMonths));
  let rate = rateForMonth(m, m.startMonth);
  let payment = monthlyPaymentCents(balance, rate, remaining);
  const initialPaymentCents = payment;

  const extrasByMonth = new Map<string, Prepayment[]>();
  for (const p of m.prepayments) {
    if (p.amountCents <= 0) continue;
    const list = extrasByMonth.get(p.month) ?? [];
    list.push(p);
    extrasByMonth.set(p.month, list);
  }

  let totalInterest = 0;
  let totalExtra = 0;
  let totalPaid = 0;
  // Salvaguarda: el plan nunca puede alargarse más allá del plazo original.
  const maxRows = remaining;

  for (let k = 0; balance > 0 && k < maxRows; k++) {
    const month = addMonths(m.startMonth, k);
    const effRate = rateForMonth(m, month);
    if (effRate !== rate) {
      rate = effRate;
      payment = monthlyPaymentCents(balance, rate, remaining);
    }

    const interest = Math.round((balance * Math.max(0, rate)) / 1200);
    let principal = payment - interest;
    if (principal >= balance || remaining <= 1 || k === maxRows - 1) principal = balance;
    if (principal < 0) principal = 0;
    const paid = principal + interest;
    balance -= principal;
    remaining -= 1;

    let extra = 0;
    for (const p of extrasByMonth.get(month) ?? []) {
      if (balance <= 0) break;
      const amt = Math.min(p.amountCents, balance);
      balance -= amt;
      extra += amt;
      if (balance > 0) {
        if (p.mode === 'payment') {
          payment = monthlyPaymentCents(balance, rate, remaining);
        } else {
          remaining = Math.min(remaining, paymentsToRepay(balance, rate, payment));
        }
      }
    }

    totalInterest += interest;
    totalExtra += extra;
    totalPaid += paid + extra;
    rows.push({
      n: k + 1,
      month,
      ratePct: rate,
      paymentCents: paid,
      interestCents: interest,
      principalCents: principal,
      extraCents: extra,
      balanceCents: balance,
    });
  }

  return {
    rows,
    initialPaymentCents,
    totalInterestCents: totalInterest,
    totalExtraCents: totalExtra,
    totalPaidCents: totalPaid,
    endMonth: rows.at(-1)?.month ?? m.startMonth,
  };
}

export interface MortgageStatus {
  /** Cuotas ya pagadas (meses anteriores a `asOf`). */
  paidPayments: number;
  /** Cuotas pendientes, incluida la del mes `asOf`. */
  paymentsLeft: number;
  principalPaidCents: number;
  interestPaidCents: number;
  /** Capital pendiente al empezar el mes `asOf`. */
  outstandingCents: number;
  /** Intereses que quedan por pagar. */
  interestLeftCents: number;
  /** Cuota del mes `asOf` (null si aún no ha empezado o ya terminó). */
  current: ScheduleRow | null;
  /** Próxima cuota a pagar (la del mes actual o la primera si no ha empezado). */
  next: ScheduleRow | null;
  state: 'pending' | 'active' | 'finished';
  /** % del capital amortizado (0–100). */
  progressPct: number;
}

export function mortgageStatus(
  m: Mortgage,
  schedule: MortgageSchedule,
  asOf: string,
): MortgageStatus {
  let principalPaid = 0;
  let interestPaid = 0;
  let paid = 0;
  for (const r of schedule.rows) {
    if (r.month >= asOf) break;
    principalPaid += r.principalCents + r.extraCents;
    interestPaid += r.interestCents;
    paid++;
  }
  const current = schedule.rows.find((r) => r.month === asOf) ?? null;
  const next = schedule.rows.find((r) => r.month >= asOf) ?? null;
  const outstanding = Math.max(0, m.principalCents - principalPaid);
  const state = asOf < m.startMonth ? 'pending' : next ? 'active' : 'finished';
  return {
    paidPayments: paid,
    paymentsLeft: schedule.rows.length - paid,
    principalPaidCents: principalPaid,
    interestPaidCents: interestPaid,
    outstandingCents: outstanding,
    interestLeftCents: schedule.totalInterestCents - interestPaid,
    current,
    next,
    state,
    progressPct: m.principalCents > 0 ? Math.min(100, (principalPaid / m.principalCents) * 100) : 0,
  };
}

export interface YearSummary {
  year: number;
  paymentCents: number;
  interestCents: number;
  principalCents: number;
  extraCents: number;
  endBalanceCents: number;
}

/** Cuadro de amortización agregado por años naturales. */
export function scheduleByYear(rows: ScheduleRow[]): YearSummary[] {
  const out: YearSummary[] = [];
  for (const r of rows) {
    const year = Number(r.month.slice(0, 4));
    let y = out.at(-1);
    if (!y || y.year !== year) {
      y = {
        year,
        paymentCents: 0,
        interestCents: 0,
        principalCents: 0,
        extraCents: 0,
        endBalanceCents: 0,
      };
      out.push(y);
    }
    y.paymentCents += r.paymentCents;
    y.interestCents += r.interestCents;
    y.principalCents += r.principalCents;
    y.extraCents += r.extraCents;
    y.endBalanceCents = r.balanceCents;
  }
  return out;
}

export interface PrepaymentSavings {
  interestSavedCents: number;
  monthsSaved: number;
}

/** Ahorro de las amortizaciones anticipadas frente al plan sin ellas. */
export function prepaymentSavings(m: Mortgage, withExtras: MortgageSchedule): PrepaymentSavings {
  const base = buildSchedule({ ...m, prepayments: [] });
  return {
    interestSavedCents: base.totalInterestCents - withExtras.totalInterestCents,
    monthsSaved: Math.max(0, monthsBetween(withExtras.endMonth, base.endMonth)),
  };
}
