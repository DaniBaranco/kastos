// Detección de esquema, validación de imports y migradores → v4.
// Un import corrupto lanza ImportError SIN tocar los datos existentes
// (la escritura la hace la capa db solo si esto valida).
//
// Historia de esquemas:
//  - v1: app original de gastos/ingresos (sin schemaVersion; IndexedDB propio).
//  - v2: primera reescritura (schemaVersion 2, con movements/categories/rules).
//  - v3: concepto "bolsa de ahorro" (schemaVersion 3: entries + patterns + goals).
//  - v4: hipoteca + gastos del hogar (schemaVersion 4).
// De v1 se migran los gastos y sus categorías (los ingresos y metas se
// descartan). De v2/v3 solo se conservan los ajustes: su ahorro y objetivos
// ya no existen en la app.

import type { Expense, ExpenseCategory, ExportBundle, Mortgage, Settings } from './types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from './types';
import { eurosToCents } from './money';

export class ImportError extends Error {}

export interface MigrationDeps {
  makeId: () => string;
  now: Date;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN'] as const;

export type DetectedSchema = 'v1' | 'v2' | 'v3' | 'v4' | 'unknown';

export function detectSchema(data: unknown): DetectedSchema {
  if (typeof data !== 'object' || data === null) return 'unknown';
  const d = data as Record<string, unknown>;
  if (d.schemaVersion === 4) return 'v4';
  if (d.schemaVersion === 3) return 'v3';
  if (d.schemaVersion === 2) return 'v2';
  if (typeof d.schemaVersion !== 'number' && Array.isArray(d.transactions)) return 'v1';
  return 'unknown';
}

/** Punto de entrada del import: detecta el esquema y devuelve un bundle v4 validado. */
export function importAny(data: unknown, deps: MigrationDeps): ExportBundle {
  const schema = detectSchema(data);
  if (schema === 'v1') return migrateV1(data, deps);
  if (schema === 'v2' || schema === 'v3') return migrateSettingsOnly(data);
  if (schema === 'v4') return validateV4Bundle(data);
  throw new ImportError('Archivo no reconocido: no parece un export de Kastos.');
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

function rate(v: unknown, field: string): number {
  const r = num(v, field);
  if (r < 0 || r > 100) fail(`${field} fuera de 0–100`);
  return r;
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
    categoriesSeeded:
      s.categoriesSeeded === undefined
        ? undefined
        : bool(s.categoriesSeeded, 'settings.categoriesSeeded'),
  };
}

function parseMortgage(raw: unknown, i: number): Mortgage {
  const f = `mortgages[${i}]`;
  const m = rec(raw, f);
  const principalCents = int(m.principalCents, `${f}.principalCents`);
  if (principalCents <= 0) fail(`${f}.principalCents debe ser positivo`);
  const termMonths = int(m.termMonths, `${f}.termMonths`);
  if (termMonths < 1 || termMonths > 600) fail(`${f}.termMonths fuera de 1–600`);
  return {
    id: str(m.id, `${f}.id`),
    name: str(m.name, `${f}.name`),
    principalCents,
    annualRatePct: rate(m.annualRatePct, `${f}.annualRatePct`),
    termMonths,
    startMonth: monthStr(m.startMonth, `${f}.startMonth`),
    rateChanges: arr(m.rateChanges, `${f}.rateChanges`).map((rc, j) => {
      const c = rec(rc, `${f}.rateChanges[${j}]`);
      return {
        id: str(c.id, `${f}.rateChanges[${j}].id`),
        fromMonth: monthStr(c.fromMonth, `${f}.rateChanges[${j}].fromMonth`),
        annualRatePct: rate(c.annualRatePct, `${f}.rateChanges[${j}].annualRatePct`),
      };
    }),
    prepayments: arr(m.prepayments, `${f}.prepayments`).map((rp, j) => {
      const p = rec(rp, `${f}.prepayments[${j}]`);
      const amountCents = int(p.amountCents, `${f}.prepayments[${j}].amountCents`);
      if (amountCents <= 0) fail(`${f}.prepayments[${j}].amountCents debe ser positivo`);
      if (p.mode !== 'term' && p.mode !== 'payment') fail(`${f}.prepayments[${j}].mode inválido`);
      return {
        id: str(p.id, `${f}.prepayments[${j}].id`),
        month: monthStr(p.month, `${f}.prepayments[${j}].month`),
        amountCents,
        mode: p.mode,
      };
    }),
    includeInExpenses: bool(m.includeInExpenses, `${f}.includeInExpenses`),
    createdAt: str(m.createdAt, `${f}.createdAt`),
  };
}

// ────────────────────────── Validación v4 ──────────────────────────

export function validateV4Bundle(data: unknown): ExportBundle {
  const d = rec(data, 'export');
  if (d.schemaVersion !== SCHEMA_VERSION) {
    fail(`schemaVersion ${String(d.schemaVersion)} no soportada (esperada ${SCHEMA_VERSION})`);
  }

  const mortgages = arr(d.mortgages, 'mortgages').map(parseMortgage);

  const categories: ExpenseCategory[] = arr(d.categories, 'categories').map((raw, i) => {
    const c = rec(raw, `categories[${i}]`);
    return {
      id: str(c.id, `categories[${i}].id`),
      name: str(c.name, `categories[${i}].name`),
      emoji: str(c.emoji, `categories[${i}].emoji`),
      archived: bool(c.archived, `categories[${i}].archived`),
    };
  });
  const categoryIds = new Set(categories.map((c) => c.id));

  const expenses: Expense[] = arr(d.expenses, 'expenses').map((raw, i) => {
    const e = rec(raw, `expenses[${i}]`);
    const categoryId = str(e.categoryId, `expenses[${i}].categoryId`);
    if (!categoryIds.has(categoryId)) fail(`expenses[${i}] apunta a una categoría inexistente`);
    return {
      id: str(e.id, `expenses[${i}].id`),
      month: monthStr(e.month, `expenses[${i}].month`),
      categoryId,
      amountCents: int(e.amountCents, `expenses[${i}].amountCents`),
      note: optStr(e.note, `expenses[${i}].note`),
      createdAt: str(e.createdAt, `expenses[${i}].createdAt`),
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date(0).toISOString(),
    mortgages,
    categories,
    expenses,
    settings: parseSettings(d.settings),
  };
}

// ────────────────────────── Migrador v2/v3 → v4 ──────────────────────────

// v2 y v3 modelaban ahorro y objetivos, que ya no existen: solo se conservan
// los ajustes (moneda, nombre, tema). Las categorías por defecto se siembran
// al cargar.
export function migrateSettingsOnly(data: unknown): ExportBundle {
  const d = rec(data, 'export');
  const s = (typeof d.settings === 'object' && d.settings !== null ? d.settings : {}) as Record<
    string,
    unknown
  >;
  const settings = parseSettings({
    currency: s.currency ?? 'EUR',
    theme: s.theme ?? 'system',
    userName: s.userName,
    welcomeSeen: s.welcomeSeen,
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date(0).toISOString(),
    mortgages: [],
    categories: [],
    expenses: [],
    settings,
  };
}

// ────────────────────────── Migrador v1 → v4 ──────────────────────────

// Esquema v1 documentado en docs/v1-schema.md. Los movimientos de tipo
// "expense" se convierten en gastos del mes de su fecha (importe en euros
// float → céntimos) y sus categorías se recrean con UUID nuevos. Las
// plantillas recurrentes se migran como gasto normal (en v4 se usa "copiar
// del mes anterior"). Ingresos y metas se descartan.
interface V1Transaction {
  type?: string;
  amount?: number;
  description?: string;
  categoryId?: number;
  date?: string;
  note?: string;
}

interface V1Category {
  id?: number;
  emoji?: string;
  name?: string;
}

export function migrateV1(data: unknown, deps: MigrationDeps): ExportBundle {
  const d = rec(data, 'export v1');
  if (!Array.isArray(d.transactions)) fail('no parece un export de Kastos v1');
  const nowISO = deps.now.toISOString();

  const v1Categories = (Array.isArray(d.categories) ? d.categories : []) as V1Category[];
  const v1Tx = d.transactions as V1Transaction[];

  const categories: ExpenseCategory[] = [];
  const catMap = new Map<number, string>();
  let fallbackId: string | null = null;
  const categoryFor = (v1Id: unknown): string => {
    if (typeof v1Id === 'number') {
      const known = catMap.get(v1Id);
      if (known) return known;
      const c = v1Categories.find((x) => x.id === v1Id);
      if (c) {
        const id = deps.makeId();
        categories.push({
          id,
          name: typeof c.name === 'string' && c.name !== '' ? c.name : 'Sin nombre',
          emoji: typeof c.emoji === 'string' && c.emoji !== '' ? c.emoji : '📦',
          archived: false,
        });
        catMap.set(v1Id, id);
        return id;
      }
    }
    if (!fallbackId) {
      fallbackId = deps.makeId();
      categories.push({ id: fallbackId, name: 'Sin categoría', emoji: '📦', archived: false });
    }
    return fallbackId;
  };

  const expenses: Expense[] = [];
  v1Tx.forEach((tx, i) => {
    if (tx.type !== 'expense') return;
    if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount) || tx.amount < 0) {
      fail(`transactions[${i}].amount inválido en el export v1`);
    }
    if (typeof tx.date !== 'string' || !DATE_RE.test(tx.date)) {
      fail(`transactions[${i}].date inválida en el export v1`);
    }
    const parts = [tx.description, tx.note].filter(
      (s): s is string => typeof s === 'string' && s.trim() !== '',
    );
    expenses.push({
      id: deps.makeId(),
      month: tx.date.slice(0, 7),
      categoryId: categoryFor(tx.categoryId),
      amountCents: eurosToCents(tx.amount),
      note: parts.length > 0 ? parts.join(' · ') : undefined,
      createdAt: nowISO,
    });
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
    mortgages: [],
    categories,
    expenses,
    settings: {
      ...DEFAULT_SETTINGS,
      currency,
      userName:
        typeof v1Settings.userName === 'string' && v1Settings.userName !== ''
          ? v1Settings.userName
          : undefined,
    },
  };
}
