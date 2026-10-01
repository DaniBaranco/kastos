// Modelo de datos de Kastos v3 (hipoteca + gastos del hogar).
// Regla de oro: los importes son SIEMPRE céntimos enteros (number).

export const SCHEMA_VERSION = 4;

export type Currency = 'EUR' | 'USD' | 'GBP' | 'MXN';
export type Theme = 'light' | 'dark' | 'system';

/** Revisión del tipo de interés (hipotecas variables/mixtas, Euríbor…). */
export interface RateChange {
  id: string;
  /** YYYY-MM: primera cuota a la que se aplica el nuevo tipo. */
  fromMonth: string;
  annualRatePct: number;
}

/**
 * Amortización anticipada: pago extra de capital tras la cuota de ese mes.
 * - `term`: se mantiene la cuota y se acorta el plazo.
 * - `payment`: se mantiene el plazo y baja la cuota.
 */
export interface Prepayment {
  id: string;
  month: string;
  amountCents: number;
  mode: 'term' | 'payment';
}

/** Préstamo hipotecario con sistema de amortización francés (cuota constante). */
export interface Mortgage {
  id: string;
  name: string;
  /** Capital prestado. */
  principalCents: number;
  /** Tipo de interés nominal anual (TIN) inicial, en %. */
  annualRatePct: number;
  /** Plazo total en meses (número de cuotas). */
  termMonths: number;
  /** YYYY-MM de la primera cuota. */
  startMonth: string;
  rateChanges: RateChange[];
  prepayments: Prepayment[];
  /** Sumar la cuota a los gastos de cada mes. */
  includeInExpenses: boolean;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  emoji: string;
  /** Archivada: no se ofrece para gastos nuevos, pero conserva su histórico. */
  archived: boolean;
}

/** Gasto de un mes (puede haber varios por mes y categoría: p. ej. dos facturas). */
export interface Expense {
  id: string;
  /** YYYY-MM al que se imputa. */
  month: string;
  categoryId: string;
  amountCents: number;
  note?: string;
  createdAt: string;
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
  /** Las categorías por defecto ya se sembraron (no volver a crearlas). */
  categoriesSeeded?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  theme: 'system',
  schemaVersion: SCHEMA_VERSION,
};

/** Categorías iniciales: los gastos típicos de un hogar. */
export const DEFAULT_CATEGORIES: ReadonlyArray<Pick<ExpenseCategory, 'name' | 'emoji'>> = [
  { name: 'Luz', emoji: '⚡' },
  { name: 'Gas', emoji: '🔥' },
  { name: 'Agua', emoji: '💧' },
  { name: 'Internet y móvil', emoji: '📶' },
  { name: 'Comunidad', emoji: '🏢' },
  { name: 'Seguros', emoji: '🛡️' },
  { name: 'Impuestos (IBI…)', emoji: '🧾' },
  { name: 'Alimentación', emoji: '🛒' },
  { name: 'Transporte', emoji: '🚗' },
  { name: 'Otros', emoji: '📦' },
];

/** Formato del export/import JSON (schemaVersion 4). */
export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  mortgages: Mortgage[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  settings: Settings;
}
