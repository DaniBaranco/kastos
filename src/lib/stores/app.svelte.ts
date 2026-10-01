// Estado global de la app (runes). La UI lee de aquí y llama a las acciones;
// nunca calcula dinero ni toca Dexie directamente.

import type { Expense, ExpenseCategory, ExportBundle, Mortgage, Settings } from '../core/types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, SCHEMA_VERSION } from '../core/types';
import { importAny, detectSchema } from '../core/migrate';
import { buildSchedule } from '../core/mortgage';
import { copyMonthExpenses } from '../core/expenses';
import {
  categoriesRepo,
  expensesRepo,
  loadAll,
  mortgagesRepo,
  replaceAll,
  resetAll,
  saveSettings,
} from '../db/repos';

const uuid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}

class AppStore {
  ready = $state(false);
  mortgages = $state<Mortgage[]>([]);
  categories = $state<ExpenseCategory[]>([]);
  expenses = $state<Expense[]>([]);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });

  /** Cuadro de amortización de cada hipoteca (derivado, nunca persistido). */
  schedules = $derived(
    this.mortgages.map((mortgage) => ({ mortgage, schedule: buildSchedule(mortgage) })),
  );

  categoryById = $derived(new Map(this.categories.map((c) => [c.id, c])));

  async init(): Promise<void> {
    const data = await loadAll();
    this.mortgages = data.mortgages;
    this.categories = data.categories;
    this.expenses = data.expenses;
    this.settings = data.settings;
    await this.seedCategoriesIfNeeded();
    this.ready = true;
  }

  /** Siembra las categorías típicas del hogar la primera vez. */
  private async seedCategoriesIfNeeded(): Promise<void> {
    if (this.settings.categoriesSeeded) return;
    if (this.categories.length === 0) {
      const seeded = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uuid(), archived: false }));
      await categoriesRepo.bulkPut(seeded);
      this.categories = seeded;
    }
    await this.updateSettings({ categoriesSeeded: true });
  }

  // ── Hipotecas ────────────────────────────────────────────────

  async saveMortgage(m: Mortgage): Promise<void> {
    await mortgagesRepo.put($state.snapshot(m) as Mortgage);
    this.mortgages = upsert(this.mortgages, m);
  }

  async deleteMortgage(id: string): Promise<void> {
    await mortgagesRepo.delete(id);
    this.mortgages = this.mortgages.filter((m) => m.id !== id);
  }

  // ── Categorías ───────────────────────────────────────────────

  async saveCategory(c: ExpenseCategory): Promise<void> {
    await categoriesRepo.put(c);
    this.categories = upsert(this.categories, c);
  }

  /** Borra la categoría; si tiene gastos, la archiva para conservar el histórico. */
  async deleteCategory(id: string): Promise<'deleted' | 'archived'> {
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) return 'deleted';
    if (this.expenses.some((e) => e.categoryId === id)) {
      await this.saveCategory({ ...cat, archived: true });
      return 'archived';
    }
    await categoriesRepo.delete(id);
    this.categories = this.categories.filter((c) => c.id !== id);
    return 'deleted';
  }

  // ── Gastos ───────────────────────────────────────────────────

  async saveExpense(e: Expense): Promise<void> {
    await expensesRepo.put(e);
    this.expenses = upsert(this.expenses, e);
  }

  async deleteExpense(id: string): Promise<void> {
    await expensesRepo.delete(id);
    this.expenses = this.expenses.filter((e) => e.id !== id);
  }

  /** Copia los gastos de `from` a `to`. Devuelve cuántos se han creado. */
  async copyMonth(from: string, to: string): Promise<number> {
    const copies = copyMonthExpenses(this.expenses, from, to, { makeId: uuid, now: new Date() });
    if (copies.length === 0) return 0;
    await expensesRepo.bulkPut(copies);
    this.expenses = [...this.expenses, ...copies];
    return copies.length;
  }

  // ── Ajustes ──────────────────────────────────────────────────

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...patch, schemaVersion: SCHEMA_VERSION };
    await saveSettings($state.snapshot(this.settings));
  }

  // ── Export / Import / Reset ──────────────────────────────────

  buildExport(): ExportBundle {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowISO(),
      mortgages: $state.snapshot(this.mortgages),
      categories: $state.snapshot(this.categories),
      expenses: $state.snapshot(this.expenses),
      settings: $state.snapshot(this.settings),
    };
  }

  async markExported(): Promise<void> {
    await this.updateSettings({ lastExportAt: nowISO() });
  }

  /**
   * Importa un JSON de cualquier versión. Valida ANTES de escribir: si lanza,
   * los datos actuales quedan intactos. Devuelve el esquema origen detectado.
   */
  async importJSON(raw: string): Promise<'v1' | 'v2' | 'v3' | 'v4'> {
    const parsed: unknown = JSON.parse(raw);
    const bundle = importAny(parsed, { makeId: uuid, now: new Date() });
    const detected = detectSchema(parsed);
    const source = detected === 'unknown' ? 'v4' : detected;
    // Conservar preferencias locales que no viajan en exports antiguos.
    bundle.settings.welcomeSeen = this.settings.welcomeSeen || bundle.settings.welcomeSeen;
    await replaceAll(bundle);
    this.mortgages = bundle.mortgages;
    this.categories = bundle.categories;
    this.expenses = bundle.expenses;
    this.settings = bundle.settings;
    if (this.categories.length === 0) {
      this.settings = { ...this.settings, categoriesSeeded: false };
      await this.seedCategoriesIfNeeded();
    }
    return source;
  }

  async wipe(): Promise<void> {
    await resetAll();
    this.mortgages = [];
    this.categories = [];
    this.expenses = [];
    this.settings = { ...DEFAULT_SETTINGS, welcomeSeen: true };
    await this.seedCategoriesIfNeeded();
  }

  /** ¿Toca recordar la copia de seguridad? (>30 días o nunca, habiendo datos). */
  get backupDue(): 'never' | 'stale' | null {
    const hasData = this.mortgages.length > 0 || this.expenses.length > 0;
    if (!hasData) return null;
    if (!this.settings.lastExportAt) return 'never';
    const ageDays = (Date.now() - Date.parse(this.settings.lastExportAt)) / 86_400_000;
    return ageDays > 30 ? 'stale' : null;
  }
}

export const app = new AppStore();
