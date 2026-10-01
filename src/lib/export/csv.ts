// Export CSV es-ES: separador ";", BOM UTF-8, decimales con coma.

import type { Expense, ExpenseCategory, Mortgage } from '../core/types';
import type { MortgageSchedule } from '../core/mortgage';

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function csv(header: string[], rows: string[][]): string {
  return '\uFEFF' + [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export function expensesCSV(expenses: Expense[], categories: ExpenseCategory[]): string {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const rows = [...expenses]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((e) => {
      const cat = catById.get(e.categoryId);
      return [
        e.month,
        csvCell(cat ? `${cat.emoji} ${cat.name}` : ''),
        csvAmount(e.amountCents),
        csvCell(e.note ?? ''),
      ];
    });
  return csv(['Mes', 'Categoría', 'Importe', 'Nota'], rows);
}

export function scheduleCSV(m: Mortgage, s: MortgageSchedule): string {
  const rows = s.rows.map((r) => [
    String(r.n),
    r.month,
    r.ratePct.toLocaleString('es-ES'),
    csvAmount(r.paymentCents),
    csvAmount(r.interestCents),
    csvAmount(r.principalCents),
    csvAmount(r.extraCents),
    csvAmount(r.balanceCents),
  ]);
  return csv(
    [
      'Cuota',
      'Mes',
      'TIN %',
      'Cuota (€)',
      'Intereses',
      'Capital',
      'Amortización extra',
      `Pendiente (${m.name.replace(/;/g, ',')})`,
    ],
    rows,
  );
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
