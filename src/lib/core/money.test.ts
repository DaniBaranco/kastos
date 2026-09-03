import { describe, expect, it } from 'vitest';
import { eurosToCents, formatCents, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it('acepta formato inglés y español', () => {
    expect(parseAmountToCents('1234.56')).toBe(123456);
    expect(parseAmountToCents('1234,56')).toBe(123456);
    expect(parseAmountToCents('1.234,56')).toBe(123456);
    expect(parseAmountToCents('1,234.56')).toBe(123456);
  });

  it('acepta números y enteros', () => {
    expect(parseAmountToCents(42.5)).toBe(4250);
    expect(parseAmountToCents('100')).toBe(10000);
    expect(parseAmountToCents('0')).toBe(0);
  });

  it('puntos en grupos de 3 sin coma → miles es-ES', () => {
    expect(parseAmountToCents('1.000')).toBe(100000);
    expect(parseAmountToCents('12.345.678')).toBe(1234567800);
    // pero un decimal con punto sigue funcionando
    expect(parseAmountToCents('1.5')).toBe(150);
    expect(parseAmountToCents('3.14')).toBe(314);
  });

  it('ignora símbolos de moneda y espacios', () => {
    expect(parseAmountToCents(' 1.234,56 € ')).toBe(123456);
  });

  it('rechaza entradas no numéricas', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents(NaN)).toBeNull();
    expect(parseAmountToCents(Infinity)).toBeNull();
  });

  it('evita el clásico error de float (0.1 + 0.2)', () => {
    expect(parseAmountToCents('0.29')).toBe(29);
    expect(parseAmountToCents(19.99)).toBe(1999);
  });
});

describe('formatCents', () => {
  it('formatea es-ES', () => {
    // Intl usa espacio no separador (U+00A0) antes del símbolo
    // Nota: es-ES no agrupa 4 cifras (CLDR minimumGroupingDigits=2): se prueba con 5.
    expect(formatCents(1234567, 'EUR').replace(/\u00a0/g, ' ')).toBe('12.345,67 €');
    expect(formatCents(-5000, 'EUR')).toContain('50,00');
  });
});

describe('eurosToCents', () => {
  it('redondea correctamente floats de v1', () => {
    expect(eurosToCents(42.5)).toBe(4250);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
  });
});
