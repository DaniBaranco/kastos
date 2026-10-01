// Repositorios: única puerta de lectura/escritura a Dexie.
// El import reemplaza todo de forma atómica SOLO con un bundle ya validado.

import { db } from './db';
import type { Expense, ExpenseCategory, ExportBundle, Mortgage, Settings } from '../core/types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../core/types';

const SETTINGS_KEY = 'app';

export interface AllData {
  mortgages: Mortgage[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  settings: Settings;
}

export async function loadAll(): Promise<AllData> {
  const [mortgages, categories, expenses, settingsRow] = await Promise.all([
    db.mortgages.toArray(),
    db.categories.toArray(),
    db.expenses.toArray(),
    db.settings.get(SETTINGS_KEY),
  ]);
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...((settingsRow?.value as Partial<Settings>) ?? {}),
    schemaVersion: SCHEMA_VERSION,
  };
  return { mortgages, categories, expenses, settings };
}

export const mortgagesRepo = {
  put: (m: Mortgage) => db.mortgages.put(m),
  delete: (id: string) => db.mortgages.delete(id),
};

export const categoriesRepo = {
  put: (c: ExpenseCategory) => db.categories.put(c),
  bulkPut: (cs: ExpenseCategory[]) => db.categories.bulkPut(cs),
  delete: (id: string) => db.categories.delete(id),
};

export const expensesRepo = {
  put: (e: Expense) => db.expenses.put(e),
  bulkPut: (es: Expense[]) => db.expenses.bulkPut(es),
  delete: (id: string) => db.expenses.delete(id),
};

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: settings });
}

const ALL_TABLES = () => [db.mortgages, db.categories, db.expenses, db.settings];

/** Sustituye TODO el contenido por el bundle (import). Transacción atómica. */
export async function replaceAll(bundle: ExportBundle): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    await Promise.all([db.mortgages.clear(), db.categories.clear(), db.expenses.clear()]);
    await Promise.all([
      db.mortgages.bulkAdd(bundle.mortgages),
      db.categories.bulkAdd(bundle.categories),
      db.expenses.bulkAdd(bundle.expenses),
      db.settings.put({ key: SETTINGS_KEY, value: bundle.settings }),
    ]);
  });
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    await Promise.all(ALL_TABLES().map((t) => t.clear()));
  });
}
