// Simulación de un patrón de ahorro: "si aparto X €/mes (con un interés anual
// opcional), ¿cuánto tendré dentro de N meses?".
//
// Interés con capitalización mensual y aportación vencida, iterativo:
//   saldo = saldo × (1 + r/12) + aportación
// que equivale a FV = P·(1+i)^n + A·[((1+i)^n − 1)/i] con i = r/12, y funciona
// con r = 0 sin división por cero.

import { addMonths } from './dates';

export interface SimulationInput {
  /** Punto de partida (normalmente la bolsa de ahorro actual). */
  initialCents: number;
  /** Aportación mensual del patrón. */
  monthlyCents: number;
  /** Interés anual estimado en % (0 = hucha sin rendimiento). */
  annualRatePct: number;
  /** Horizonte en meses (≥ 1). */
  months: number;
  /** Mes de partida YYYY-MM; el primer punto proyectado es el siguiente. */
  fromMonth: string;
}

export interface SimulationPoint {
  month: string;
  totalCents: number;
  contributedCents: number;
  interestCents: number;
}

export interface SimulationResult {
  points: SimulationPoint[];
  finalCents: number;
  contributedCents: number;
  interestCents: number;
}

export function simulatePattern(input: SimulationInput): SimulationResult {
  const months = Math.max(1, Math.floor(input.months));
  const monthly = Math.max(0, input.monthlyCents);
  const initial = input.initialCents;
  const i = Math.max(0, input.annualRatePct) / 100 / 12;

  let balance = initial;
  let contributed = initial;
  const points: SimulationPoint[] = [];

  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + i) + monthly;
    contributed += monthly;
    const total = Math.round(balance);
    points.push({
      month: addMonths(input.fromMonth, m),
      totalCents: total,
      contributedCents: contributed,
      interestCents: total - contributed,
    });
  }

  const finalCents = Math.round(balance);
  return {
    points,
    finalCents,
    contributedCents: contributed,
    interestCents: finalCents - contributed,
  };
}
