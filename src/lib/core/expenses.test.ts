import { describe, expect, it } from 'vitest';
import {
  averageMonthlyCents,
  categoryMatrix,
  categoryTotals,
  compareMonth,
  copyMonthExpenses,
  MORTGAGE_CATEGORY_ID,
  mortgageItems,
  monthlySeries,
  pctChange,
  seasonality,
  seasonExtremes,
  toItems,
  trackedMonths,
  yearOverYear,
  type AmountItem,
} from './expenses';
import { buildSchedule } from './mortgage';
import type { Expense, Mortgage } from './types';

const exp = (month: string, categoryId: string, amountCents: number): Expense => ({
  id: `${month}-${categoryId}-${amountCents}`,
  month,
  categoryId,
  amountCents,
  createdAt: '2025-01-01T00:00:00.000Z',
});

// Gas caro en invierno, barato en verano; agua bimestral.
const EXPENSES: Expense[] = [
  exp('2025-01', 'gas', 9000),
  exp('2025-01', 'water', 4000),
  exp('2025-02', 'gas', 8000),
  exp('2025-07', 'gas', 1500),
  exp('2025-07', 'water', 4500),
  exp('2026-01', 'gas', 11000),
  exp('2026-01', 'gas', 1000), // segunda factura del mismo mes
  exp('2026-02', 'gas', 7000),
  exp('2026-02', 'water', 4200),
];
const ITEMS = toItems(EXPENSES);

describe('totales mensuales', () => {
  it('suma varias facturas del mismo mes y categoría', () => {
    expect(categoryTotals(ITEMS, '2026-01')).toEqual([{ categoryId: 'gas', amountCents: 12000 }]);
    expect(monthlySeries(ITEMS, ['2026-01', '2026-02', '2026-03'])).toEqual([12000, 11200, 0]);
    expect(monthlySeries(ITEMS, ['2026-02'], 'water')).toEqual([4200]);
  });

  it('trackedMonths ignora las partidas virtuales', () => {
    const virtual: AmountItem = {
      month: '2030-01',
      categoryId: MORTGAGE_CATEGORY_ID,
      amountCents: 1,
      virtual: true,
    };
    expect(trackedMonths([...ITEMS, virtual])).not.toContain('2030-01');
    expect(trackedMonths(ITEMS)).toHaveLength(5);
  });
});

describe('compareMonth', () => {
  it('compara con el mes anterior y el mismo mes del año pasado', () => {
    const c = compareMonth(ITEMS, '2026-02', 'gas');
    expect(c).toEqual({ currentCents: 7000, previousCents: 12000, lastYearCents: 8000 });
    expect(pctChange(c.currentCents, c.lastYearCents)).toBeCloseTo(-12.5);
  });

  it('meses sin registros son "sin datos", no cero', () => {
    const c = compareMonth(ITEMS, '2025-07');
    expect(c.previousCents).toBeNull();
    expect(c.lastYearCents).toBeNull();
    expect(pctChange(100, null)).toBeNull();
  });
});

describe('estacionalidad e interanual', () => {
  it('media por mes natural entre años con datos', () => {
    const s = seasonality(ITEMS, 'gas');
    expect(s[0]).toEqual({ calMonth: 1, avgCents: 10500, samples: 2 }); // (9000 + 12000) / 2
    expect(s[6]).toEqual({ calMonth: 7, avgCents: 1500, samples: 1 });
    expect(s[5]!.avgCents).toBeNull();
    const { max, min } = seasonExtremes(s);
    expect(max!.calMonth).toBe(1);
    expect(min!.calMonth).toBe(7);
  });

  it('un mes registrado sin factura de agua cuenta como 0 en su media', () => {
    expect(seasonality(ITEMS, 'water')[0]!.avgCents).toBe(2000); // (4000 + 0) / 2
  });

  it('interanual: 12 valores por año, null donde no hay datos', () => {
    const y = yearOverYear(ITEMS, 'gas');
    expect(y.map((r) => r.year)).toEqual([2025, 2026]);
    expect(y[1]!.values.slice(0, 3)).toEqual([12000, 7000, null]);
  });

  it('media mensual solo de meses con datos', () => {
    expect(averageMonthlyCents(ITEMS, '2026-01', '2026-06')).toBe(Math.round((12000 + 11200) / 2));
    expect(averageMonthlyCents(ITEMS, '2027-01', '2027-06')).toBeNull();
  });

  it('matriz categoría × mes', () => {
    const m = categoryMatrix(ITEMS, ['2026-01', '2026-02']);
    expect(m.get('gas')).toEqual([12000, 7000]);
    expect(m.get('water')).toEqual([0, 4200]);
  });
});

describe('hipoteca como gasto', () => {
  const mortgage: Mortgage = {
    id: 'm',
    name: 'Casa',
    principalCents: 12_000_000,
    annualRatePct: 0,
    termMonths: 120,
    startMonth: '2026-01',
    rateChanges: [],
    prepayments: [],
    includeInExpenses: true,
    createdAt: '',
  };

  it('genera una partida virtual por cuota dentro del rango', () => {
    const items = mortgageItems(
      [{ mortgage, schedule: buildSchedule(mortgage) }],
      '2025-12',
      '2026-03',
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ month: '2026-01', amountCents: 100_000, virtual: true });
  });

  it('respeta includeInExpenses = false', () => {
    const m = { ...mortgage, includeInExpenses: false };
    expect(
      mortgageItems([{ mortgage: m, schedule: buildSchedule(m) }], '2026-01', '2026-12'),
    ).toEqual([]);
  });
});

describe('copyMonthExpenses', () => {
  it('duplica los gastos de un mes en otro con ids nuevos', () => {
    let n = 0;
    const copies = copyMonthExpenses(EXPENSES, '2026-02', '2026-03', {
      makeId: () => `new-${++n}`,
      now: new Date(2026, 2, 1),
    });
    expect(copies).toHaveLength(2);
    expect(copies.every((c) => c.month === '2026-03' && c.id.startsWith('new-'))).toBe(true);
  });
});
