import { describe, expect, it } from 'vitest';
import {
  addMonths,
  clampDayToMonth,
  currentMonthKey,
  monthRange,
  monthsBetween,
  remainingMonths,
  todayISO,
} from './dates';

describe('todayISO / currentMonthKey', () => {
  it('usa fecha civil local, no UTC', () => {
    // 1 de enero a las 00:30 local: toISOString() daría el 31/12 en UTC+1
    const d = new Date(2026, 0, 1, 0, 30);
    expect(todayISO(d)).toBe('2026-01-01');
    expect(currentMonthKey(d)).toBe('2026-01');
  });
});

describe('addMonths', () => {
  it('cruza años en ambas direcciones', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-06', 0)).toBe('2026-06');
    expect(addMonths('2026-01', -13)).toBe('2024-12');
  });
});

describe('monthsBetween', () => {
  it('calcula diferencias con signo', () => {
    expect(monthsBetween('2026-09', '2026-12')).toBe(3);
    expect(monthsBetween('2026-12', '2026-09')).toBe(-3);
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
  });
});

describe('remainingMonths', () => {
  it('cuenta el mes actual como periodo de aportación', () => {
    expect(remainingMonths('2026-09', '2026-09-30')).toBe(1);
    expect(remainingMonths('2026-09', '2026-12-01')).toBe(4);
  });
  it('deadline en el pasado → 0', () => {
    expect(remainingMonths('2026-09', '2026-08-31')).toBe(0);
  });
});

describe('clampDayToMonth', () => {
  it('ajusta el día a los días reales del mes', () => {
    expect(clampDayToMonth('2026-02', 28)).toBe('2026-02-28');
    expect(clampDayToMonth('2024-02', 30)).toBe('2024-02-29'); // bisiesto
    expect(clampDayToMonth('2026-04', 31)).toBe('2026-04-30');
    expect(clampDayToMonth('2026-01', 0)).toBe('2026-01-01');
  });
});

describe('monthRange', () => {
  it('incluye ambos extremos y devuelve vacío si from > to', () => {
    expect(monthRange('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(monthRange('2026-05', '2026-04')).toEqual([]);
  });
});
