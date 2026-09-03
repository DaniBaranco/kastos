// Repositorios: única puerta de lectura/escritura a Dexie.
// El import reemplaza todo de forma atómica SOLO con un bundle ya validado.

import { db } from './db';
import type {
  ExportBundle,
  SavingsEntry,
  SavingsGoal,
  SavingsPattern,
  Settings,
} from '../core/types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../core/types';

const SETTINGS_KEY = 'app';

export interface AllData {
  savingsEntries: SavingsEntry[];
  patterns: SavingsPattern[];
  goals: SavingsGoal[];
  settings: Settings;
}

export async function loadAll(): Promise<AllData> {
  const [savingsEntries, patterns, goals, settingsRow] = await Promise.all([
    db.savingsEntries.toArray(),
    db.patterns.toArray(),
    db.goals.toArray(),
    db.settings.get(SETTINGS_KEY),
  ]);
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...((settingsRow?.value as Partial<Settings>) ?? {}),
    schemaVersion: SCHEMA_VERSION,
  };
  return { savingsEntries, patterns, goals, settings };
}

export const savingsRepo = {
  put: (e: SavingsEntry) => db.savingsEntries.put(e),
  delete: (id: string) => db.savingsEntries.delete(id),
};

export const patternsRepo = {
  put: (p: SavingsPattern) => db.patterns.put(p),
  bulkPut: (ps: SavingsPattern[]) => db.patterns.bulkPut(ps),
  delete: (id: string) => db.patterns.delete(id),
};

export const goalsRepo = {
  put: (g: SavingsGoal) => db.goals.put(g),
  delete: (id: string) => db.goals.delete(id),
};

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: settings });
}

/** Sustituye TODO el contenido por el bundle (import). Transacción atómica. */
export async function replaceAll(bundle: ExportBundle): Promise<void> {
  await db.transaction('rw', [db.savingsEntries, db.patterns, db.goals, db.settings], async () => {
    await Promise.all([db.savingsEntries.clear(), db.patterns.clear(), db.goals.clear()]);
    await Promise.all([
      db.savingsEntries.bulkAdd(bundle.savingsEntries),
      db.patterns.bulkAdd(bundle.patterns),
      db.goals.bulkAdd(bundle.goals),
      db.settings.put({ key: SETTINGS_KEY, value: bundle.settings }),
    ]);
  });
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', [db.savingsEntries, db.patterns, db.goals, db.settings], async () => {
    await Promise.all([
      db.savingsEntries.clear(),
      db.patterns.clear(),
      db.goals.clear(),
      db.settings.clear(),
    ]);
  });
}
