import { describe, expect, it } from 'vitest';
import {
  detectSchema,
  importAny,
  ImportError,
  migrateV1,
  migrateV2,
  validateV3Bundle,
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
    { id: 2, type: 'expense', amount: 42.5, description: 'Mercadona', date: '2026-09-01' },
  ],
  categories: [{ id: 1, emoji: '🛒', name: 'Alimentación', color: '#30d158', budget: 300 }],
  goals: [
    { id: 1, name: 'Vacaciones', target: 1500, saved: 350.5, deadline: '2027-06-01', emoji: '🏖️' },
    { id: 2, name: 'Sin fecha', target: 100, saved: 0, deadline: '', emoji: '🎯' },
  ],
  settings: { currency: 'EUR', userName: 'Dani' },
  exportedAt: '2026-09-15T10:00:00.000Z',
};

/** Export v2 mínimo (la reescritura anterior, con movimientos). */
const V2_EXPORT = {
  schemaVersion: 2,
  exportedAt: '2026-09-14T10:00:00.000Z',
  movements: [{ id: 'm1', type: 'expense', amountCents: 4250 }],
  categories: [],
  recurringRules: [],
  savingsEntries: [
    { id: 'e1', month: '2026-08', amountCents: 20000, createdAt: '2026-08-01T00:00:00.000Z' },
    {
      id: 'e2',
      month: '2026-09',
      amountCents: 15000,
      goalId: 'g1',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  goals: [
    {
      id: 'g1',
      name: 'Coche',
      emoji: '🚗',
      targetCents: 500000,
      deadline: '2027-12-01',
      archived: false,
    },
  ],
  settings: { currency: 'EUR', userName: 'Dani', theme: 'system', savingsTargetPct: 20 },
};

function validV3(): ExportBundle {
  return {
    schemaVersion: 3,
    exportedAt: '2026-09-15T10:00:00.000Z',
    savingsEntries: [
      { id: 'e1', month: '2026-08', amountCents: 20000, createdAt: '2026-08-01T00:00:00.000Z' },
    ],
    patterns: [
      { id: 'p1', name: 'Base', emoji: '🐷', monthlyCents: 20000, annualRatePct: 0, active: true },
      {
        id: 'p2',
        name: 'Ambicioso',
        emoji: '🚀',
        monthlyCents: 40000,
        annualRatePct: 3,
        active: false,
      },
    ],
    goals: [
      {
        id: 'g1',
        name: 'Boda',
        emoji: '💍',
        targetCents: 1200000,
        deadline: '2027-08-31',
        archived: false,
      },
    ],
    settings: { currency: 'EUR', theme: 'system', schemaVersion: 3 },
  };
}

describe('detectSchema', () => {
  it('distingue v1, v2, v3 y desconocido', () => {
    expect(detectSchema(V1_EXPORT)).toBe('v1');
    expect(detectSchema(V2_EXPORT)).toBe('v2');
    expect(detectSchema(validV3())).toBe('v3');
    expect(detectSchema({ foo: 1 })).toBe('unknown');
    expect(detectSchema(null)).toBe('unknown');
  });
});

describe('migrateV1', () => {
  const bundle = migrateV1(V1_EXPORT, deps);

  it('convierte metas: euros → céntimos y saved → punto de partida asignado', () => {
    expect(bundle.goals[0]!.targetCents).toBe(150000);
    expect(bundle.savingsEntries).toHaveLength(1);
    const e = bundle.savingsEntries[0]!;
    expect(e.amountCents).toBe(35050);
    expect(e.goalId).toBe(bundle.goals[0]!.id);
    expect(e.month).toBe('2026-09');
    expect(e.initial).toBe(true); // ahorro previo: no cuenta como aportación del mes
  });

  it('descarta los movimientos v1 (la app ya no modela gastos/ingresos)', () => {
    expect(bundle.patterns).toEqual([]);
    expect('movements' in bundle).toBe(false);
  });

  it('deadline vacío en v1 → +12 meses; settings con defaults v3', () => {
    expect(bundle.goals[1]!.deadline).toBe('2027-09-01');
    expect(bundle.settings.userName).toBe('Dani');
    expect(bundle.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('el resultado pasa la validación v3', () => {
    expect(() => validateV3Bundle(bundle)).not.toThrow();
  });

  it('export v1 corrupto → ImportError', () => {
    const bad = { ...V1_EXPORT, goals: [{ target: 'mucho' }] };
    expect(() => migrateV1(bad, deps)).toThrow(ImportError);
  });
});

describe('migrateV2', () => {
  const bundle = migrateV2(V2_EXPORT);

  it('conserva ahorro y objetivos; descarta movimientos y savingsTargetPct', () => {
    expect(bundle.savingsEntries).toHaveLength(2);
    expect(bundle.goals).toHaveLength(1);
    expect(bundle.patterns).toEqual([]);
    expect('savingsTargetPct' in bundle.settings).toBe(false);
    expect(bundle.settings.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('el resultado pasa la validación v3', () => {
    expect(() => validateV3Bundle(bundle)).not.toThrow();
  });
});

describe('validateV3Bundle', () => {
  it('acepta un bundle válido', () => {
    expect(validateV3Bundle(JSON.parse(JSON.stringify(validV3()))).patterns).toHaveLength(2);
  });

  it('rechaza céntimos no enteros', () => {
    const b = JSON.parse(JSON.stringify(validV3()));
    b.savingsEntries[0].amountCents = 123.45;
    expect(() => validateV3Bundle(b)).toThrow(/céntimos/);
  });

  it('rechaza dos patrones activos', () => {
    const b = JSON.parse(JSON.stringify(validV3()));
    b.patterns[1].active = true;
    expect(() => validateV3Bundle(b)).toThrow(/un patrón activo/);
  });

  it('rechaza patrón con mensualidad negativa o interés fuera de rango', () => {
    const b1 = JSON.parse(JSON.stringify(validV3()));
    b1.patterns[0].monthlyCents = -1;
    expect(() => validateV3Bundle(b1)).toThrow(ImportError);
    const b2 = JSON.parse(JSON.stringify(validV3()));
    b2.patterns[0].annualRatePct = 200;
    expect(() => validateV3Bundle(b2)).toThrow(ImportError);
  });

  it('rechaza fechas mal formadas y schemaVersion desconocida', () => {
    const b1 = JSON.parse(JSON.stringify(validV3()));
    b1.goals[0].deadline = '01/06/2027';
    expect(() => validateV3Bundle(b1)).toThrow(ImportError);
    const b2 = JSON.parse(JSON.stringify(validV3()));
    b2.schemaVersion = 99;
    expect(() => validateV3Bundle(b2)).toThrow(/schemaVersion/);
  });
});

describe('importAny', () => {
  it('enruta v1 y v2 a sus migradores y v3 al validador', () => {
    expect(importAny(V1_EXPORT, deps).schemaVersion).toBe(SCHEMA_VERSION);
    expect(importAny(V2_EXPORT, deps).savingsEntries).toHaveLength(2);
    expect(importAny(validV3(), deps).patterns).toHaveLength(2);
  });

  it('archivo desconocido → ImportError con mensaje claro', () => {
    expect(() => importAny({ hola: 'mundo' }, deps)).toThrow(/no parece un export de Kastos/);
  });
});
