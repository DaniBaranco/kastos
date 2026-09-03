// Utilidades de dinero. Los importes viajan como céntimos enteros;
// aquí vive la única frontera con floats (parseo y formateo).

import type { Currency } from './types';

/** Formatea céntimos como moneda es-ES (p. ej. 123456 → "1.234,56 €"). */
export function formatCents(cents: number, currency: Currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Formato compacto sin decimales cuando son ,00 (para cifras grandes de UI). */
export function formatCentsCompact(cents: number, currency: Currency = 'EUR'): string {
  const hasDecimals = cents % 100 !== 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(cents / 100);
}

/**
 * Convierte la entrada del usuario a céntimos enteros.
 * Acepta "1234.56", "1.234,56", "1234,56", 1234.56…
 * Devuelve null si no es un número válido.
 */
export function parseAmountToCents(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  let s = input.trim().replace(/[€$£\s]/g, '');
  if (s === '') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // El separador que aparece más a la derecha es el decimal.
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    s = s.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma > -1) {
    s = s.replace(',', '.');
  } else if (lastDot > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Solo puntos en grupos de 3 → separador de miles es-ES ("1.000" = mil).
    s = s.split('.').join('');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Céntimos de euros float (para el migrador v1: 42.5 € → 4250). */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}
