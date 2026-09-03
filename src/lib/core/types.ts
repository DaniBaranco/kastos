// Modelo de datos de Kastos v2 (concepto "bolsa de ahorro").
// Regla de oro: los importes son SIEMPRE céntimos enteros (number).

export const SCHEMA_VERSION = 3;

export type Currency = 'EUR' | 'USD' | 'GBP' | 'MXN';
export type Theme = 'light' | 'dark' | 'system';

/** Aportación o retirada de la bolsa de ahorro. */
export interface SavingsEntry {
  id: string;
  /** YYYY-MM; puede haber varias entradas por mes. */
  month: string;
  /** Positivo = aportación; negativo = retirada. */
  amountCents: number;
  /**
   * Punto de partida: ahorro que el usuario YA tenía al empezar con la app.
   * Suma a la bolsa, pero no cuenta como aportación "del mes" ni entra en el
   * cálculo del ritmo (todo usuario parte de 0 en cuanto a ritmo mensual).
   */
  initial?: boolean;
  /** Aportación asignada a un objetivo concreto. */
  goalId?: string;
  note?: string;
  createdAt: string;
}

/**
 * Patrón de ahorro: cuánto quiere apartar el usuario cada mes.
 * Puede haber varios (escenarios para simular); como máximo uno activo,
 * que es el compromiso contra el que se mide el mes y los objetivos.
 */
export interface SavingsPattern {
  id: string;
  name: string;
  emoji: string;
  /** Aportación mensual del patrón. */
  monthlyCents: number;
  /** Interés anual estimado (%) para simulaciones; 0 = hucha sin rendimiento. */
  annualRatePct: number;
  active: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  targetCents: number;
  /** YYYY-MM-DD, obligatorio: sin fecha no hay plan. */
  deadline: string;
  archived: boolean;
  // savedCents NO se almacena: se deriva de SavingsEntry con goalId.
}

export interface Settings {
  currency: Currency;
  userName?: string;
  theme: Theme;
  schemaVersion: number;
  /** ISO de la última exportación, para el recordatorio de backup. */
  lastExportAt?: string;
  /** La guía de bienvenida ya se mostró. */
  welcomeSeen?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  theme: 'system',
  schemaVersion: SCHEMA_VERSION,
};

/** Formato del export/import JSON (schemaVersion 3). */
export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  savingsEntries: SavingsEntry[];
  patterns: SavingsPattern[];
  goals: SavingsGoal[];
  settings: Settings;
}
