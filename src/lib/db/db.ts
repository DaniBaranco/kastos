// Base de datos local (IndexedDB vía Dexie), "kastos-v2".
// Historia del esquema:
//  - v1: libro de gastos/ingresos + ahorro y objetivos.
//  - v2: pivote a "bolsa de ahorro" (patterns, sin movimientos).
//  - v3: pivote a hipoteca + gastos del hogar. Se eliminan las tablas de
//        ahorro (savingsEntries, patterns, goals) y se crean mortgages,
//        categories y expenses. Los ajustes se conservan.

import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Expense, ExpenseCategory, Mortgage } from '../core/types';

interface SettingsRow {
  key: string;
  value: unknown;
}

export class KastosDB extends Dexie {
  mortgages!: EntityTable<Mortgage, 'id'>;
  categories!: EntityTable<ExpenseCategory, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
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
    this.version(3).stores({
      patterns: null,
      savingsEntries: null,
      goals: null,
      mortgages: 'id',
      categories: 'id',
      expenses: 'id, month, categoryId',
      settings: 'key',
    });
  }
}

export const db = new KastosDB();
