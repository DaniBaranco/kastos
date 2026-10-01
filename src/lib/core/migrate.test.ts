import { describe, expect, it } from 'vitest';
import {
  detectSchema,
  importAny,
  ImportError,
  migrateSettingsOnly,
  migrateV1,
  validateV4Bundle,
} from './migrate';
import { SCHEMA_VERSION, type ExportBundle } from './types';

let seq = 0;
const deps = {
  makeId: () => `uuid-${++seq}`,
  now: new Date(2026, 8, 15, 12, 0), // 15 sep 2026 local
};

/** Export v1 realista (ver docs/v1-schema.md). */
const V1_EXPORT = {
  transactions: [
    { id: 1, type: 'income', amount: 2000, description: 'Nómina', date: '2026-08-28' },
    {
      id: 2,
      type: 'expense',
      amount: 42.5,
      description: 'Mercadona',
      categoryId: 1,
      date: '2026-09-01',
    },
    { id: 3, type: 'expense', amount: 30, description: 'Luz', categoryId: 99, date: '2026-08-03' },
  ],
  categories: [
    { id: 1, emoji: '🛒', name: 'Alimentación', color: '#30d158', budget: 300 },
    { id: 2, emoji: '💼', name: 'Nómina', color: '#000', budget: 0 },
  ],
  goals: [{ id: 1, name: 'Vacaciones', target: 1500, saved: 350.5, deadline: '', emoji: '🏖️' }],
  settings: { currency: 'EUR', userName: 'Dani' },
  exportedAt: '2026-09-15T10:00:00.000Z',
};

const V2_EXPORT = {
  schemaVersion: 2,
  movements: [{ id: 'm1', type: 'expense', amountCents: 4250 }],
  savingsEntries: [],
  goals: [],
  settings: { currency: 'USD', userName: 'Dani', theme: 'dark', savingsTargetPct: 20 },
};

const V3_EXPORT = {
  schemaVersion: 3,
  savingsEntries: [{ id: 'e1', month: '2026-08', amountCents: 20000 }],
  patterns: [],
  goals: [],
  settings: { currency: 'EUR', theme: 'light', schemaVersion: 3, welcomeSeen: true },
};

function validV4(): ExportBundle {
  return {
    schemaVersion: 4,
    exportedAt: '2026-09-15T10:00:00.000Z',
    mortgages: [
      {
        id: 'h1',
        name: 'Piso',
        principalCents: 18_000_000,
        annualRatePct: 2.5,
        termMonths: 360,
        startMonth: '2023-05',
        rateChanges: [{ id: 'r1', fromMonth: '2024-05', annualRatePct: 3.1 }],
        prepayments: [{ id: 'p1', month: '2025-01', amountCents: 500_000, mode: 'term' }],
        includeInExpenses: true,
        createdAt: '2023-05-01T00:00:00.000Z',
      },
    ],
    categories: [{ id: 'c1', name: 'Gas', emoji: '🔥', archived: false }],
    expenses: [
      {
        id: 'e1',
        month: '2026-01',
        categoryId: 'c1',
        amountCents: 9000,
        createdAt: '2026-01-10T00:00:00.000Z',
      },
    ],
    settings: { currency: 'EUR', theme: 'system', schemaVersion: 4, categoriesSeeded: true },
  };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('detectSchema', () => {
  it('distingue v1, v2, v3, v4 y desconocido', () => {
    expect(detectSchema(V1_EXPORT)).toBe('v1');
    expect(detectSchema(V2_EXPORT)).toBe('v2');
    expect(detectSchema(V3_EXPORT)).toBe('v3');
    expect(detectSchema(validV4())).toBe('v4');
    expect(detectSchema({ foo: 1 })).toBe('unknown');
    expect(detectSchema(null)).toBe('unknown');
  });
});

describe('migrateV1', () => {
  const bundle = migrateV1(V1_EXPORT, deps);

  it('convierte los gastos (euros → céntimos, fecha → mes) y descarta ingresos', () => {
    expect(bundle.expenses).toHaveLength(2);
    const [merca, luz] = bundle.expenses;
    expect(merca).toMatchObject({ month: '2026-09', amountCents: 4250, note: 'Mercadona' });
    expect(luz).toMatchObject({ month: '2026-08', amountCents: 3000 });
  });

  it('recrea solo las categorías usadas; las colgantes van a "Sin categoría"', () => {
    const names = bundle.categories.map((c) => c.name).sort();
    expect(names).toEqual(['Alimentación', 'Sin categoría']);
    const ids = new Set(bundle.categories.map((c) => c.id));
    expect(bundle.expenses.every((e) => ids.has(e.categoryId))).toBe(true);
  });

  it('conserva ajustes y pasa la validación v4', () => {
    expect(bundle.settings.userName).toBe('Dani');
    expect(bundle.mortgages).toEqual([]);
    expect(bundle.schemaVersion).toBe(SCHEMA_VERSION);
    expect(() => validateV4Bundle(clone(bundle))).not.toThrow();
  });

  it('export v1 corrupto → ImportError', () => {
    const bad = { ...V1_EXPORT, transactions: [{ type: 'expense', amount: 'mucho' }] };
    expect(() => migrateV1(bad, deps)).toThrow(ImportError);
  });
});

describe('migrateSettingsOnly (v2/v3)', () => {
  it('conserva solo los ajustes', () => {
    const b2 = migrateSettingsOnly(V2_EXPORT);
    expect(b2.settings).toMatchObject({ currency: 'USD', theme: 'dark', userName: 'Dani' });
    expect('savingsTargetPct' in b2.settings).toBe(false);
    expect(b2.expenses).toEqual([]);
    const b3 = migrateSettingsOnly(V3_EXPORT);
    expect(b3.settings.welcomeSeen).toBe(true);
    expect(() => validateV4Bundle(clone(b3))).not.toThrow();
  });
});

describe('validateV4Bundle', () => {
  it('acepta un bundle válido', () => {
    expect(validateV4Bundle(clone(validV4())).mortgages[0]!.prepayments).toHaveLength(1);
  });

  it('rechaza céntimos no enteros', () => {
    const b = clone(validV4());
    b.expenses[0]!.amountCents = 12.5;
    expect(() => validateV4Bundle(b)).toThrow(/céntimos/);
  });

  it('rechaza gastos con categoría inexistente', () => {
    const b = clone(validV4());
    b.expenses[0]!.categoryId = 'nope';
    expect(() => validateV4Bundle(b)).toThrow(/categoría inexistente/);
  });

  it('rechaza hipotecas inválidas', () => {
    const b1 = clone(validV4());
    b1.mortgages[0]!.termMonths = 0;
    expect(() => validateV4Bundle(b1)).toThrow(ImportError);
    const b2 = clone(validV4());
    b2.mortgages[0]!.startMonth = '2023-13';
    expect(() => validateV4Bundle(b2)).toThrow(/YYYY-MM/);
    const b3 = clone(validV4());
    (b3.mortgages[0]!.prepayments[0] as { mode: string }).mode = 'otro';
    expect(() => validateV4Bundle(b3)).toThrow(/mode/);
  });

  it('rechaza schemaVersion desconocida', () => {
    const b = clone(validV4());
    b.schemaVersion = 99;
    expect(() => validateV4Bundle(b)).toThrow(/schemaVersion/);
  });
});

describe('importAny', () => {
  it('enruta cada versión a su migrador o validador', () => {
    expect(importAny(V1_EXPORT, deps).expenses).toHaveLength(2);
    expect(importAny(V2_EXPORT, deps).settings.currency).toBe('USD');
    expect(importAny(V3_EXPORT, deps).mortgages).toEqual([]);
    expect(importAny(validV4(), deps).mortgages).toHaveLength(1);
  });

  it('archivo desconocido → ImportError con mensaje claro', () => {
    expect(() => importAny({ hola: 'mundo' }, deps)).toThrow(/no parece un export de Kastos/);
  });
});
