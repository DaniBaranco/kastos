// Base de datos local (IndexedDB vía Dexie), "kastos-v2".
// La versión 2 del esquema materializa el pivote al concepto "bolsa de
// ahorro": añade patterns y elimina las tablas del libro de gastos/ingresos
// (movements, categories, recurringRules). El ahorro y los objetivos se
// conservan tal cual entre versiones.

import Dexie, { type EntityTable, type Table } from 'dexie';
import type { SavingsEntry, SavingsGoal, SavingsPattern } from '../core/types';

interface SettingsRow {
  key: string;
  value: unknown;
}

export class KastosDB extends Dexie {
  savingsEntries!: EntityTable<SavingsEntry, 'id'>;
  patterns!: EntityTable<SavingsPattern, 'id'>;
  goals!: EntityTable<SavingsGoal, 'id'>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('kastos-v2');
    this.version(1).stores({
      movements: 'id, date, type, categoryId, recurringId',
      categories: 'id, archived',
      recurringRules: 'id, active',
      savingsEntries: 'id, month, goalId',
      goals: 'id, deadline, archived',
      settings: 'key',
    });
    this.version(2).stores({
      movements: null,
      categories: null,
      recurringRules: null,
      patterns: 'id, active',
      savingsEntries: 'id, month, goalId',
      goals: 'id, deadline, archived',
      settings: 'key',
    });
  }
}

export const db = new KastosDB();
