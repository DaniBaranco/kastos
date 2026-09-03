import { describe, expect, it } from 'vitest';
import {
  accumulatedSeries,
  fulfilledStreak,
  savedInMonthCents,
  savingsRateCents,
  totalSavedCents,
} from './savings';
import type { SavingsEntry } from './types';

function entry(month: string, amountCents: number, goalId?: string): SavingsEntry {
  return { id: `${month}-${amountCents}`, month, amountCents, goalId, createdAt: 'now' };
}

describe('totalSaved / savedInMonth', () => {
  const entries = [
    entry('2026-07', 20000),
    entry('2026-08', 15000, 'goal-1'),
    entry('2026-08', -5000), // retirada
    entry('2026-09', 10000, 'goal-1'),
  ];

  it('suma neta con retiradas', () => {
    expect(totalSavedCents(entries)).toBe(40000);
    expect(savedInMonthCents(entries, '2026-08')).toBe(10000);
  });

  it('filtra por objetivo y por mes tope', () => {
    expect(totalSavedCents(entries, { goalId: 'goal-1' })).toBe(25000);
    expect(totalSavedCents(entries, { toMonth: '2026-08' })).toBe(30000);
  });
});

describe('accumulatedSeries', () => {
  it('arrastra lo acumulado antes del rango', () => {
    const entries = [entry('2026-06', 50000), entry('2026-08', 10000)];
    const serie = accumulatedSeries(entries, '2026-07', '2026-09');
    expect(serie).toEqual([
      { month: '2026-07', accumulatedCents: 50000 },
      { month: '2026-08', accumulatedCents: 60000 },
      { month: '2026-09', accumulatedCents: 60000 },
    ]);
  });
});

describe('entradas initial (punto de partida)', () => {
  const entries: SavingsEntry[] = [
    { id: 'i1', month: '2026-09', amountCents: 500000, initial: true, createdAt: 'now' },
    entry('2026-09', 20000),
  ];

  it('suman a la bolsa y al acumulado', () => {
    expect(totalSavedCents(entries)).toBe(520000);
    const serie = accumulatedSeries(entries, '2026-09', '2026-10');
    expect(serie[0]!.accumulatedCents).toBe(520000);
  });

  it('NO cuentan como ahorro del mes ni en el ritmo', () => {
    expect(savedInMonthCents(entries, '2026-09')).toBe(20000);
    expect(savingsRateCents(entries, '2026-09', 6)).toBe(20000);
  });

  it('solo con punto de partida, el ritmo sigue siendo 0 (se parte de cero)', () => {
    const onlyInitial = [entries[0]!];
    expect(savingsRateCents(onlyInitial, '2026-09', 6)).toBe(0);
    expect(savedInMonthCents(onlyInitial, '2026-09')).toBe(0);
    expect(totalSavedCents(onlyInitial)).toBe(500000);
  });
});

describe('fulfilledStreak (racha de patrón)', () => {
  const PATTERN = 15000; // 150 €/mes

  it('cuenta meses consecutivos cumplidos, incluido el actual si ya cumple', () => {
    const entries = [entry('2026-07', 15000), entry('2026-08', 20000), entry('2026-09', 15000)];
    expect(fulfilledStreak(entries, PATTERN, '2026-09')).toBe(3);
  });

  it('el mes en curso sin cumplir no rompe la racha', () => {
    const entries = [entry('2026-07', 15000), entry('2026-08', 15000), entry('2026-09', 5000)];
    expect(fulfilledStreak(entries, PATTERN, '2026-09')).toBe(2);
  });

  it('un mes por debajo del patrón corta la racha', () => {
    const entries = [entry('2026-06', 15000), entry('2026-07', 1000), entry('2026-08', 15000)];
    expect(fulfilledStreak(entries, PATTERN, '2026-08')).toBe(1);
  });

  it('varias aportaciones del mismo mes suman para cumplir', () => {
    const entries = [entry('2026-09', 8000), entry('2026-09', 7000)];
    expect(fulfilledStreak(entries, PATTERN, '2026-09')).toBe(1);
  });

  it('el punto de partida (initial) no cumple el patrón; sin patrón no hay racha', () => {
    const initial: SavingsEntry = {
      id: 'i',
      month: '2026-09',
      amountCents: 999900,
      initial: true,
      createdAt: 'now',
    };
    expect(fulfilledStreak([initial], PATTERN, '2026-09')).toBe(0);
    expect(fulfilledStreak([entry('2026-09', 15000)], 0, '2026-09')).toBe(0);
  });
});

describe('savingsRateCents (media móvil)', () => {
  it('media de la ventana completa, con meses vacíos a 0', () => {
    // 6 meses: 30000 + 0 + 0 + 0 + 0 + 30000 = 60000 / 6 = 10000
    const entries = [entry('2026-04', 30000), entry('2026-09', 30000)];
    expect(savingsRateCents(entries, '2026-09', 6)).toBe(10000);
  });

  it('histórico más corto que la ventana → divide por los meses con histórico', () => {
    const entries = [entry('2026-08', 20000), entry('2026-09', 10000)];
    expect(savingsRateCents(entries, '2026-09', 6)).toBe(15000);
  });

  it('sin aportaciones → 0; aportaciones futuras al mes de corte no cuentan', () => {
    expect(savingsRateCents([], '2026-09', 6)).toBe(0);
    expect(savingsRateCents([entry('2026-10', 99900)], '2026-09', 6)).toBe(0);
  });

  it('las retiradas reducen el ritmo', () => {
    const entries = [entry('2026-08', 20000), entry('2026-09', -10000)];
    expect(savingsRateCents(entries, '2026-09', 6)).toBe(5000);
  });
});
