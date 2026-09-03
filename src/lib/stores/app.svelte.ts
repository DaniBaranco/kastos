// Estado global de la app (runes). La UI lee de aquí y llama a las acciones;
// nunca calcula dinero ni toca Dexie directamente.

import type {
  ExportBundle,
  SavingsEntry,
  SavingsGoal,
  SavingsPattern,
  Settings,
} from '../core/types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../core/types';
import { importAny } from '../core/migrate';
import {
  goalsRepo,
  loadAll,
  patternsRepo,
  replaceAll,
  resetAll,
  saveSettings,
  savingsRepo,
} from '../db/repos';

const uuid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();

class AppStore {
  ready = $state(false);
  savingsEntries = $state<SavingsEntry[]>([]);
  patterns = $state<SavingsPattern[]>([]);
  goals = $state<SavingsGoal[]>([]);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });

  /** El patrón activo es el compromiso mensual del usuario (como mucho uno). */
  get activePattern(): SavingsPattern | undefined {
    return this.patterns.find((p) => p.active);
  }

  async init(): Promise<void> {
    const data = await loadAll();
    this.savingsEntries = data.savingsEntries;
    this.patterns = data.patterns;
    this.goals = data.goals;
    this.settings = data.settings;
    this.ready = true;
  }

  // ── Bolsa de ahorro ──────────────────────────────────────────

  async saveEntry(entry: SavingsEntry): Promise<void> {
    await savingsRepo.put(entry);
    const exists = this.savingsEntries.some((e) => e.id === entry.id);
    this.savingsEntries = exists
      ? this.savingsEntries.map((e) => (e.id === entry.id ? entry : e))
      : [...this.savingsEntries, entry];
  }

  async deleteEntry(id: string): Promise<void> {
    await savingsRepo.delete(id);
    this.savingsEntries = this.savingsEntries.filter((e) => e.id !== id);
  }

  // ── Patrones de ahorro ───────────────────────────────────────

  async savePattern(pattern: SavingsPattern): Promise<void> {
    // Solo puede haber un patrón activo: activar uno desactiva el resto.
    if (pattern.active) {
      const toDeactivate = this.patterns.filter((p) => p.active && p.id !== pattern.id);
      if (toDeactivate.length > 0) {
        const deactivated = toDeactivate.map((p) => ({ ...p, active: false }));
        await patternsRepo.bulkPut(deactivated);
        const ids = new Set(deactivated.map((p) => p.id));
        this.patterns = this.patterns.map((p) => (ids.has(p.id) ? { ...p, active: false } : p));
      }
    }
    await patternsRepo.put(pattern);
    const exists = this.patterns.some((p) => p.id === pattern.id);
    this.patterns = exists
      ? this.patterns.map((p) => (p.id === pattern.id ? pattern : p))
      : [...this.patterns, pattern];
  }

  async deletePattern(id: string): Promise<void> {
    await patternsRepo.delete(id);
    this.patterns = this.patterns.filter((p) => p.id !== id);
  }

  // ── Objetivos ────────────────────────────────────────────────

  async saveGoal(goal: SavingsGoal): Promise<void> {
    await goalsRepo.put(goal);
    const exists = this.goals.some((g) => g.id === goal.id);
    this.goals = exists
      ? this.goals.map((g) => (g.id === goal.id ? goal : g))
      : [...this.goals, goal];
  }

  async deleteGoal(id: string): Promise<void> {
    await goalsRepo.delete(id);
    this.goals = this.goals.filter((g) => g.id !== id);
    // Desasignar aportaciones del objetivo (se conserva el ahorro).
    const linked = this.savingsEntries.filter((e) => e.goalId === id);
    for (const e of linked) await savingsRepo.put({ ...e, goalId: undefined });
    if (linked.length > 0) {
      this.savingsEntries = this.savingsEntries.map((e) =>
        e.goalId === id ? { ...e, goalId: undefined } : e,
      );
    }
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
      savingsEntries: $state.snapshot(this.savingsEntries),
      patterns: $state.snapshot(this.patterns),
      goals: $state.snapshot(this.goals),
      settings: $state.snapshot(this.settings),
    };
  }

  async markExported(): Promise<void> {
    await this.updateSettings({ lastExportAt: nowISO() });
  }

  /**
   * Importa un JSON (v1, v2 o v3). Valida ANTES de escribir: si lanza, los
   * datos actuales quedan intactos. Devuelve el esquema origen detectado.
   */
  async importJSON(raw: string): Promise<'v1' | 'v2' | 'v3'> {
    const parsed: unknown = JSON.parse(raw);
    const p = parsed as Record<string, unknown> | null;
    const source: 'v1' | 'v2' | 'v3' =
      p !== null && typeof p === 'object' && p.schemaVersion === 3
        ? 'v3'
        : p !== null && typeof p === 'object' && p.schemaVersion === 2
          ? 'v2'
          : 'v1';
    const bundle = importAny(parsed, { makeId: uuid, now: new Date() });
    // Conservar preferencias locales que no viajan en exports antiguos.
    bundle.settings.welcomeSeen = this.settings.welcomeSeen || bundle.settings.welcomeSeen;
    await replaceAll(bundle);
    this.savingsEntries = bundle.savingsEntries;
    this.patterns = bundle.patterns;
    this.goals = bundle.goals;
    this.settings = bundle.settings;
    return source;
  }

  async wipe(): Promise<void> {
    await resetAll();
    this.savingsEntries = [];
    this.patterns = [];
    this.goals = [];
    this.settings = { ...DEFAULT_SETTINGS, welcomeSeen: true };
    await saveSettings($state.snapshot(this.settings));
  }

  /** ¿Toca recordar la copia de seguridad? (>30 días o nunca, habiendo datos). */
  get backupDue(): 'never' | 'stale' | null {
    const hasData =
      this.savingsEntries.length > 0 || this.patterns.length > 0 || this.goals.length > 0;
    if (!hasData) return null;
    if (!this.settings.lastExportAt) return 'never';
    const ageDays = (Date.now() - Date.parse(this.settings.lastExportAt)) / 86_400_000;
    return ageDays > 30 ? 'stale' : null;
  }
}

export const app = new AppStore();
