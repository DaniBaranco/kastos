import { describe, expect, it } from 'vitest';
import { simulatePattern } from './simulate';

describe('simulatePattern', () => {
  it('r = 0 → proyección lineal exacta, sin división por cero', () => {
    const r = simulatePattern({
      initialCents: 100000,
      monthlyCents: 20000,
      annualRatePct: 0,
      months: 12,
      fromMonth: '2026-09',
    });
    expect(r.finalCents).toBe(100000 + 20000 * 12);
    expect(r.interestCents).toBe(0);
    expect(r.points).toHaveLength(12);
    expect(r.points[0]).toEqual({
      month: '2026-10',
      totalCents: 120000,
      contributedCents: 120000,
      interestCents: 0,
    });
    expect(r.points.at(-1)!.month).toBe('2027-09');
  });

  it('coincide con la fórmula cerrada de aportación vencida', () => {
    const P = 100000;
    const A = 10000;
    const months = 120;
    const r = simulatePattern({
      initialCents: P,
      monthlyCents: A,
      annualRatePct: 5,
      months,
      fromMonth: '2026-09',
    });
    const i = 0.05 / 12;
    const fv = P * (1 + i) ** months + A * (((1 + i) ** months - 1) / i);
    expect(Math.abs(r.finalCents - fv)).toBeLessThan(1);
    expect(r.contributedCents).toBe(P + A * months);
    expect(r.interestCents).toBe(r.finalCents - r.contributedCents);
  });

  it('la serie es coherente (total = aportado + intereses) y creciente', () => {
    const r = simulatePattern({
      initialCents: 0,
      monthlyCents: 15000,
      annualRatePct: 4,
      months: 36,
      fromMonth: '2026-01',
    });
    for (let k = 0; k < r.points.length; k++) {
      const p = r.points[k]!;
      expect(p.totalCents).toBe(p.contributedCents + p.interestCents);
      if (k > 0) expect(p.totalCents).toBeGreaterThan(r.points[k - 1]!.totalCents);
    }
  });

  it('sanea entradas raras: meses mínimos 1, aportación negativa a 0', () => {
    const r = simulatePattern({
      initialCents: 5000,
      monthlyCents: -100,
      annualRatePct: -3,
      months: 0,
      fromMonth: '2026-09',
    });
    expect(r.points).toHaveLength(1);
    expect(r.finalCents).toBe(5000);
    expect(r.interestCents).toBe(0);
  });

  it('bolsa inicial negativa (deuda) también se proyecta', () => {
    const r = simulatePattern({
      initialCents: -50000,
      monthlyCents: 10000,
      annualRatePct: 0,
      months: 5,
      fromMonth: '2026-09',
    });
    expect(r.finalCents).toBe(0);
  });
});
