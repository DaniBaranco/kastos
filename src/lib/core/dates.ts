// Fechas civiles locales sin timezone: YYYY-MM-DD para días, YYYY-MM para meses.
// Nunca se usa Date.toISOString() para fechas civiles (desplaza por UTC).

/** Fecha civil local de hoy, YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Mes actual local, YYYY-MM. */
export function currentMonthKey(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

/** YYYY-MM de una fecha YYYY-MM-DD. */
export function monthKeyOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** Suma (o resta) meses a un YYYY-MM. */
export function addMonths(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1–12
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Meses de `from` a `to` (positivo si to > from). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!);
}

/** Días que tiene un mes YYYY-MM. */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y!, m!, 0).getDate();
}

/** Día 1–31 ajustado a los días reales del mes (regla dayOfMonth 1–28 + clamp). */
export function clampDayToMonth(monthKey: string, day: number): string {
  const d = Math.min(Math.max(1, day), daysInMonth(monthKey));
  return `${monthKey}-${String(d).padStart(2, '0')}`;
}

/** Lista de meses [from..to] ambos inclusive. */
export function monthRange(from: string, to: string): string[] {
  const n = monthsBetween(from, to);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addMonths(from, i));
}

/**
 * Periodos de aportación que quedan hasta un deadline, contando el mes
 * actual como periodo (deadline este mes → 1). Deadline pasado → 0.
 */
export function remainingMonths(fromMonth: string, deadlineISO: string): number {
  const diff = monthsBetween(fromMonth, monthKeyOf(deadlineISO));
  return diff < 0 ? 0 : diff + 1;
}

/** Etiqueta corta es-ES de un YYYY-MM (p. ej. "sep 26"). */
export function monthLabel(monthKey: string, style: 'short' | 'long' = 'short'): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y!, m! - 1, 1);
  if (style === 'long') {
    const s = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).replace('.', '');
}
