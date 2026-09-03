// Detección de esquema, validación de imports y migradores v1/v2 → v3.
// Un import corrupto lanza ImportError SIN tocar los datos existentes
// (la escritura la hace la capa db solo si esto valida).
//
// Historia de esquemas:
//  - v1: app original de gastos/ingresos (sin schemaVersion; IndexedDB propio).
//  - v2: primera reescritura (schemaVersion 2, con movements/categories/rules).
//  - v3: concepto "bolsa de ahorro" (schemaVersion 3: entries + patterns + goals).
// De v1/v2 se conserva lo que tiene sentido en v3: el ahorro y los objetivos.
// Los movimientos/categorías/recurrentes de v1/v2 se descartan (la app ya no
// modela gastos e ingresos).

import type { ExportBundle, SavingsEntry, SavingsGoal, SavingsPattern, Settings } from './types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './types';
import { eurosToCents } from './money';
import { addMonths, currentMonthKey } from './dates';

export class ImportError extends Error {}

export interface MigrationDeps {
  makeId: () => string;
  now: Date;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN'] as const;

export type DetectedSchema = 'v1' | 'v2' | 'v3' | 'unknown';

export function detectSchema(data: unknown): DetectedSchema {
  if (typeof data !== 'object' || data === null) return 'unknown';
  const d = data as Record<string, unknown>;
  if (d.schemaVersion === 3) return 'v3';
  if (d.schemaVersion === 2) return 'v2';
  if (typeof d.schemaVersion !== 'number' && Array.isArray(d.transactions)) return 'v1';
  return 'unknown';
}

/** Punto de entrada del import: detecta el esquema y devuelve un bundle v3 validado. */
export function importAny(data: unknown, deps: MigrationDeps): ExportBundle {
  const schema = detectSchema(data);
  if (schema === 'v1') return migrateV1(data, deps);
  if (schema === 'v2') return migrateV2(data);
  if (schema === 'v3') return validateV3Bundle(data);
  throw new ImportError('Archivo no reconocido: no parece un export de Kastos (v1, v2 o v3).');
}

// ────────────────────────── Helpers de validación ──────────────────────────

function fail(msg: string): never {
  throw new ImportError(`Import inválido: ${msg}`);
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string') fail(`"${field}" debe ser texto`);
  return v;
}

function optStr(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  return str(v, field);
}

function int(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    fail(`"${field}" debe ser un entero de céntimos`);
  }
  return v;
}

function num(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`"${field}" debe ser un número`);
  return v;
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') fail(`"${field}" debe ser booleano`);
  return v;
}

function dateStr(v: unknown, field: string): string {
  const s = str(v, field);
  if (!DATE_RE.test(s)) fail(`"${field}" debe tener formato YYYY-MM-DD`);
  return s;
}

function monthStr(v: unknown, field: string): string {
  const s = str(v, field);
  if (!MONTH_RE.test(s)) fail(`"${field}" debe tener formato YYYY-MM`);
  return s;
}

function arr(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) fail(`falta la lista "${field}"`);
  return v;
}

function rec(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null) fail(`"${field}" no es un objeto`);
  return v as Record<string, unknown>;
}

function parseEntries(v: unknown, field: string): SavingsEntry[] {
  return arr(v, field).map((raw, i) => {
    const e = rec(raw, `${field}[${i}]`);
    return {
      id: str(e.id, `${field}[${i}].id`),
      month: monthStr(e.month, `${field}[${i}].month`),
      amountCents: int(e.amountCents, `${field}[${i}].amountCents`),
      initial: e.initial === undefined ? undefined : bool(e.initial, `${field}[${i}].initial`),
      goalId: optStr(e.goalId, `${field}[${i}].goalId`),
      note: optStr(e.note, `${field}[${i}].note`),
      createdAt: str(e.createdAt, `${field}[${i}].createdAt`),
    };
  });
}

function parseGoals(v: unknown, field: string): SavingsGoal[] {
  return arr(v, field).map((raw, i) => {
    const g = rec(raw, `${field}[${i}]`);
    const targetCents = int(g.targetCents, `${field}[${i}].targetCents`);
    if (targetCents <= 0) fail(`${field}[${i}].targetCents debe ser positivo`);
    return {
      id: str(g.id, `${field}[${i}].id`),
      name: str(g.name, `${field}[${i}].name`),
      emoji: str(g.emoji, `${field}[${i}].emoji`),
      targetCents,
      deadline: dateStr(g.deadline, `${field}[${i}].deadline`),
      archived: bool(g.archived, `${field}[${i}].archived`),
    };
  });
}

function parseSettings(v: unknown): Settings {
  const s = rec(v, 'settings');
  const currency = str(s.currency, 'settings.currency');
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    fail(`moneda "${currency}" no soportada`);
  }
  const theme = s.theme;
  if (theme !== 'light' && theme !== 'dark' && theme !== 'system') fail('settings.theme inválido');
  return {
    currency: currency as Settings['currency'],
    userName: optStr(s.userName, 'settings.userName'),
    theme,
    schemaVersion: SCHEMA_VERSION,
    lastExportAt: optStr(s.lastExportAt, 'settings.lastExportAt'),
    welcomeSeen:
      s.welcomeSeen === undefined ? undefined : bool(s.welcomeSeen, 'settings.welcomeSeen'),
  };
}

// ────────────────────────── Validación v3 ──────────────────────────

export function validateV3Bundle(data: unknown): ExportBundle {
  const d = rec(data, 'export');
  if (d.schemaVersion !== SCHEMA_VERSION) {
    fail(`schemaVersion ${String(d.schemaVersion)} no soportada (esperada ${SCHEMA_VERSION})`);
  }

  const savingsEntries = parseEntries(d.savingsEntries, 'savingsEntries');
  const goals = parseGoals(d.goals, 'goals');

  const patterns: SavingsPattern[] = arr(d.patterns, 'patterns').map((raw, i) => {
    const p = rec(raw, `patterns[${i}]`);
    const monthlyCents = int(p.monthlyCents, `patterns[${i}].monthlyCents`);
    if (monthlyCents < 0) fail(`patterns[${i}].monthlyCents no puede ser negativo`);
    const annualRatePct = num(p.annualRatePct, `patterns[${i}].annualRatePct`);
    if (annualRatePct < 0 || annualRatePct > 100) {
      fail(`patterns[${i}].annualRatePct fuera de 0–100`);
    }
    return {
      id: str(p.id, `patterns[${i}].id`),
      name: str(p.name, `patterns[${i}].name`),
      emoji: str(p.emoji, `patterns[${i}].emoji`),
      monthlyCents,
      annualRatePct,
      active: bool(p.active, `patterns[${i}].active`),
    };
  });
  if (patterns.filter((p) => p.active).length > 1) {
    fail('solo puede haber un patrón activo');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date(0).toISOString(),
    savingsEntries,
    patterns,
    goals,
    settings: parseSettings(d.settings),
  };
}

// ────────────────────────── Migrador v2 → v3 ──────────────────────────

// El export v2 comparte formato de savingsEntries y goals con v3; se descartan
// movements, categories y recurringRules (y el savingsTargetPct de settings).
export function migrateV2(data: unknown): ExportBundle {
  const d = rec(data, 'export v2');
  const savingsEntries = parseEntries(d.savingsEntries ?? [], 'savingsEntries');
  const goals = parseGoals(d.goals ?? [], 'goals');
  const settings = parseSettings(d.settings ?? {});

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date(0).toISOString(),
    savingsEntries,
    patterns: [],
    goals,
    settings,
  };
}

// ────────────────────────── Migrador v1 → v3 ──────────────────────────

// Esquema v1 documentado en docs/v1-schema.md. De v1 solo tiene sentido en v3
// el apartado de metas: cada meta se convierte en objetivo y su `saved`
// almacenado en una aportación inicial de la bolsa asignada al objetivo.
interface V1Goal {
  id?: number;
  name?: string;
  target?: number;
  saved?: number;
  deadline?: string;
  emoji?: string;
}

export function migrateV1(data: unknown, deps: MigrationDeps): ExportBundle {
  const d = rec(data, 'export v1');
  if (!Array.isArray(d.transactions)) fail('no parece un export de Kastos v1');
  const nowISO = deps.now.toISOString();
  const month = currentMonthKey(deps.now);

  const v1Goals = (Array.isArray(d.goals) ? d.goals : []) as V1Goal[];
  const savingsEntries: SavingsEntry[] = [];

  const goals: SavingsGoal[] = v1Goals.map((g, i) => {
    if (typeof g.target !== 'number' || !Number.isFinite(g.target) || g.target <= 0) {
      fail(`goals[${i}].target inválido en el export v1`);
    }
    const id = deps.makeId();
    const deadline =
      typeof g.deadline === 'string' && DATE_RE.test(g.deadline)
        ? g.deadline
        : `${addMonths(month, 12)}-01`; // v1 permitía metas sin fecha; v3 no: +12 meses
    if (typeof g.saved === 'number' && g.saved > 0) {
      savingsEntries.push({
        id: deps.makeId(),
        month,
        amountCents: eurosToCents(g.saved),
        initial: true, // ahorro que ya existía: no cuenta como aportación del mes
        goalId: id,
        note: 'Ahorro previo (migrado de Kastos v1)',
        createdAt: nowISO,
      });
    }
    return {
      id,
      name: typeof g.name === 'string' && g.name !== '' ? g.name : `Objetivo ${i + 1}`,
      emoji: typeof g.emoji === 'string' && g.emoji !== '' ? g.emoji : '🎯',
      targetCents: eurosToCents(g.target),
      deadline,
      archived: false,
    };
  });

  const v1Settings = (typeof d.settings === 'object' && d.settings !== null ? d.settings : {}) as {
    currency?: string;
    userName?: string;
  };
  const currency = CURRENCIES.includes(v1Settings.currency as (typeof CURRENCIES)[number])
    ? (v1Settings.currency as Settings['currency'])
    : 'EUR';

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO,
    savingsEntries,
    patterns: [],
    goals,
    settings: {
      ...DEFAULT_SETTINGS,
      currency,
      userName: typeof v1Settings.userName === 'string' ? v1Settings.userName : undefined,
    },
  };
}
