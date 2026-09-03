// Export CSV es-ES: separador ";", BOM UTF-8, decimales con coma.

import type { SavingsEntry, SavingsGoal } from '../core/types';

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function savingsCSV(entries: SavingsEntry[], goals: SavingsGoal[]): string {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const header = ['Mes', 'Importe', 'Objetivo', 'Nota'].join(';');
  const rows = [...entries]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((e) => {
      const goal = e.goalId !== undefined ? goalById.get(e.goalId) : undefined;
      return [
        e.month,
        csvAmount(e.amountCents),
        csvCell(goal ? `${goal.emoji} ${goal.name}` : ''),
        csvCell(e.note ?? ''),
      ].join(';');
    });
  return '﻿' + [header, ...rows].join('\n');
}

export function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
