import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  monthlyPaymentCents,
  mortgageStatus,
  paymentsToRepay,
  prepaymentSavings,
  rateForMonth,
  scheduleByYear,
} from './mortgage';
import type { Mortgage } from './types';

function mortgage(patch: Partial<Mortgage> = {}): Mortgage {
  return {
    id: 'm1',
    name: 'Casa',
    principalCents: 15_000_000, // 150.000 €
    annualRatePct: 3,
    termMonths: 300, // 25 años
    startMonth: '2024-01',
    rateChanges: [],
    prepayments: [],
    includeInExpenses: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...patch,
  };
}

describe('monthlyPaymentCents', () => {
  it('coincide con la fórmula del sistema francés', () => {
    // 150.000 € a 25 años al 3 % → 711,32 €/mes
    expect(monthlyPaymentCents(15_000_000, 3, 300)).toBe(71_132);
  });

  it('tipo 0 → reparto lineal del capital', () => {
    expect(monthlyPaymentCents(120_000, 0, 12)).toBe(10_000);
  });

  it('paymentsToRepay es la inversa de la cuota', () => {
    expect(paymentsToRepay(15_000_000, 3, 71_132)).toBe(300);
    expect(paymentsToRepay(120_000, 0, 10_000)).toBe(12);
    expect(paymentsToRepay(100_000, 12, 1_000)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('buildSchedule', () => {
  it('amortiza exactamente el capital en el plazo pactado', () => {
    const s = buildSchedule(mortgage());
    expect(s.rows).toHaveLength(300);
    expect(s.endMonth).toBe('2048-12');
    expect(s.rows.at(-1)!.balanceCents).toBe(0);
    const principal = s.rows.reduce((a, r) => a + r.principalCents, 0);
    expect(principal).toBe(15_000_000);
    expect(s.totalPaidCents).toBe(15_000_000 + s.totalInterestCents);
    // ~63.396 € de intereses totales
    expect(Math.abs(s.totalInterestCents - 6_339_600)).toBeLessThan(500);
  });

  it('cada fila cuadra: cuota = intereses + capital', () => {
    for (const r of buildSchedule(mortgage()).rows) {
      expect(r.paymentCents).toBe(r.interestCents + r.principalCents);
    }
  });

  it('revisión de tipo: recalcula la cuota manteniendo el plazo', () => {
    const s = buildSchedule(
      mortgage({ rateChanges: [{ id: 'r1', fromMonth: '2025-01', annualRatePct: 4 }] }),
    );
    expect(s.rows).toHaveLength(300);
    expect(s.rows[11]!.ratePct).toBe(3);
    expect(s.rows[12]!.ratePct).toBe(4);
    expect(s.rows[12]!.paymentCents).toBeGreaterThan(s.rows[11]!.paymentCents);
    expect(s.rows.at(-1)!.balanceCents).toBe(0);
  });

  it('amortización anticipada reduciendo plazo: misma cuota, acaba antes', () => {
    const base = buildSchedule(mortgage());
    const m = mortgage({
      prepayments: [{ id: 'p1', month: '2025-06', amountCents: 2_000_000, mode: 'term' }],
    });
    const s = buildSchedule(m);
    expect(s.rows.length).toBeLessThan(base.rows.length);
    expect(s.rows[20]!.paymentCents).toBe(base.rows[20]!.paymentCents);
    expect(s.totalExtraCents).toBe(2_000_000);
    expect(s.rows.at(-1)!.balanceCents).toBe(0);
    const savings = prepaymentSavings(m, s);
    expect(savings.interestSavedCents).toBeGreaterThan(0);
    expect(savings.monthsSaved).toBe(base.rows.length - s.rows.length);
  });

  it('amortización anticipada reduciendo cuota: mismo plazo, cuota menor', () => {
    const base = buildSchedule(mortgage());
    const s = buildSchedule(
      mortgage({
        prepayments: [{ id: 'p1', month: '2025-06', amountCents: 2_000_000, mode: 'payment' }],
      }),
    );
    expect(s.rows).toHaveLength(300);
    expect(s.rows[20]!.paymentCents).toBeLessThan(base.rows[20]!.paymentCents);
    expect(s.totalInterestCents).toBeLessThan(base.totalInterestCents);
  });

  it('una amortización mayor que el saldo cancela el préstamo', () => {
    const s = buildSchedule(
      mortgage({
        prepayments: [{ id: 'p1', month: '2024-03', amountCents: 99_999_999, mode: 'term' }],
      }),
    );
    expect(s.rows).toHaveLength(3);
    expect(s.endMonth).toBe('2024-03');
    expect(s.rows.at(-1)!.balanceCents).toBe(0);
    expect(s.totalExtraCents).toBeLessThan(15_000_000);
  });

  it('rateForMonth usa la última revisión vigente', () => {
    const m = mortgage({
      rateChanges: [
        { id: 'b', fromMonth: '2026-01', annualRatePct: 2.5 },
        { id: 'a', fromMonth: '2025-01', annualRatePct: 4 },
      ],
    });
    expect(rateForMonth(m, '2024-06')).toBe(3);
    expect(rateForMonth(m, '2025-07')).toBe(4);
    expect(rateForMonth(m, '2030-01')).toBe(2.5);
  });
});

describe('mortgageStatus', () => {
  const m = mortgage();
  const s = buildSchedule(m);

  it('antes de empezar: pendiente, nada pagado', () => {
    const st = mortgageStatus(m, s, '2023-10');
    expect(st.state).toBe('pending');
    expect(st.paidPayments).toBe(0);
    expect(st.outstandingCents).toBe(15_000_000);
    expect(st.next!.n).toBe(1);
  });

  it('a mitad: cuotas pagadas = meses transcurridos', () => {
    const st = mortgageStatus(m, s, '2026-10');
    expect(st.state).toBe('active');
    expect(st.paidPayments).toBe(33);
    expect(st.paymentsLeft).toBe(267);
    expect(st.current!.n).toBe(34);
    expect(st.outstandingCents).toBe(s.rows[32]!.balanceCents);
    expect(st.interestPaidCents + st.interestLeftCents).toBe(s.totalInterestCents);
  });

  it('después del fin: terminada al 100 %', () => {
    const st = mortgageStatus(m, s, '2049-01');
    expect(st.state).toBe('finished');
    expect(st.outstandingCents).toBe(0);
    expect(st.progressPct).toBe(100);
  });
});

describe('scheduleByYear', () => {
  it('agrega por año natural y conserva totales', () => {
    const s = buildSchedule(mortgage({ startMonth: '2024-07' }));
    const years = scheduleByYear(s.rows);
    expect(years[0]!.year).toBe(2024);
    expect(years[0]!.paymentCents).toBe(s.rows.slice(0, 6).reduce((a, r) => a + r.paymentCents, 0));
    expect(years.reduce((a, y) => a + y.interestCents, 0)).toBe(s.totalInterestCents);
    expect(years.at(-1)!.endBalanceCents).toBe(0);
  });
});
