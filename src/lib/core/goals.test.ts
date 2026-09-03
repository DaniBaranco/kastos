import { describe, expect, it } from 'vitest';
import { aggregateGoals, analyzeGoal, realisticMonthFor } from './goals';
import type { SavingsEntry, SavingsGoal } from './types';

function goal(partial: Partial<SavingsGoal>): SavingsGoal {
  return {
    id: 'g1',
    name: 'Boda',
    emoji: '💍',
    targetCents: 1200000, // 12.000 €
    deadline: '2027-08-31',
    archived: false,
    ...partial,
  };
}

function entry(amountCents: number, goalId = 'g1'): SavingsEntry {
  return { id: String(Math.random()), month: '2026-08', amountCents, goalId, createdAt: 'now' };
}

// Mes actual de referencia: 2026-09. Deadline 2027-08 → 12 periodos de aportación.
// La referencia es el patrón de ahorro activo (o el ritmo real si no hay patrón).

describe('analyzeGoal', () => {
  it('cuota = restante / meses, redondeo al alza al céntimo', () => {
    const a = analyzeGoal(goal({}), [entry(200000)], '2026-09', 100000);
    expect(a.remainingCents).toBe(1000000);
    expect(a.monthsRemaining).toBe(12);
    // 1.000.000 / 12 = 83.333,33… → 83334 (alza)
    expect(a.quotaCents).toBe(83334);
  });

  it('on-track cuando la cuota cabe en el patrón', () => {
    const a = analyzeGoal(goal({}), [entry(200000)], '2026-09', 90000);
    expect(a.state).toBe('on-track');
  });

  it('ajustado cuando supera el patrón hasta un 25 %', () => {
    // cuota 83334; patrón 70000 → 83334 ≤ 87500 → tight
    const a = analyzeGoal(goal({}), [entry(200000)], '2026-09', 70000);
    expect(a.state).toBe('tight');
    expect(a.realisticMonth).toBeNull(); // solo se muestra si es inalcanzable
  });

  it('inalcanzable más allá del margen, con fecha alternativa realista', () => {
    const a = analyzeGoal(goal({}), [entry(200000)], '2026-09', 50000);
    expect(a.state).toBe('unreachable');
    // 1.000.000 / 50.000 = 20 meses desde 2026-09 → 2028-05
    expect(a.realisticMonth).toBe('2028-05');
    expect(a.realisticMonthLabel).toContain('2028');
  });

  it('deadline en el pasado sin completar → inalcanzable sin cuota', () => {
    const a = analyzeGoal(goal({ deadline: '2026-01-31' }), [], '2026-09', 50000);
    expect(a.state).toBe('unreachable');
    expect(a.quotaCents).toBeNull();
    expect(a.monthsRemaining).toBe(0);
  });

  it('objetivo cubierto → done, sin cuota', () => {
    const a = analyzeGoal(goal({ targetCents: 100000 }), [entry(100000)], '2026-09', 0);
    expect(a.state).toBe('done');
    expect(a.quotaCents).toBeNull();
    expect(a.remainingCents).toBe(0);
  });

  it('sin patrón ni ritmo (referencia 0) → inalcanzable y sin fecha realista', () => {
    const a = analyzeGoal(goal({}), [], '2026-09', 0);
    expect(a.state).toBe('unreachable');
    expect(a.realisticMonth).toBeNull();
  });
});

describe('realisticMonthFor', () => {
  it('redondea meses al alza', () => {
    expect(realisticMonthFor(100000, 30000, '2026-09')).toBe('2027-01'); // ceil(3,33) = 4
  });
});

describe('aggregateGoals', () => {
  it('detecta objetivos en conjunto incompatibles con el patrón', () => {
    const a1 = analyzeGoal(goal({ id: 'a' }), [], '2026-09', 90000);
    const a2 = analyzeGoal(goal({ id: 'b', targetCents: 600000 }), [], '2026-09', 90000);
    const agg = aggregateGoals([a1, a2], 90000);
    expect(agg.totalQuotaCents).toBe(a1.quotaCents! + a2.quotaCents!);
    expect(agg.overCommitted).toBe(true);
  });

  it('referencia 0 con cuotas pendientes → sobrecomprometido', () => {
    const a1 = analyzeGoal(goal({}), [], '2026-09', 0);
    expect(aggregateGoals([a1], 0).overCommitted).toBe(true);
  });
});
