import { describe, it, expect } from 'vitest';
import {
  parseSolesToCentavos,
  toDecimalString,
  formatMoneda,
  sumCentavos,
  subtractCentavos,
  MAX_SAFE_CENTAVOS,
  type Centavos,
} from '../src/money.js';

describe('Aritmética Monetaria Determinista (money.ts)', () => {
  describe('parseSolesToCentavos', () => {
    it('convierte montos enteros a céntimos correctamente', () => {
      const res = parseSolesToCentavos('5');
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe(500);
    });

    it('convierte montos con dos decimales exactos a céntimos sin flotantes', () => {
      const res1 = parseSolesToCentavos('19.90');
      expect(res1.ok).toBe(true);
      if (res1.ok) expect(res1.value).toBe(1990);

      const res2 = parseSolesToCentavos('0.50');
      expect(res2.ok).toBe(true);
      if (res2.ok) expect(res2.value).toBe(50);

      const res3 = parseSolesToCentavos('19.99');
      expect(res3.ok).toBe(true);
      if (res3.ok) expect(res3.value).toBe(1999);
    });

    it('maneja montos con un solo decimal rellenando con cero a la derecha', () => {
      const res = parseSolesToCentavos('120.5');
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe(12050);
    });

    it('rechaza cadenas vacías o con espacios en blanco', () => {
      expect(parseSolesToCentavos('').ok).toBe(false);
      expect(parseSolesToCentavos('   ').ok).toBe(false);
    });

    it('rechaza montos negativos', () => {
      const res = parseSolesToCentavos('-15.00');
      expect(res.ok).toBe(false);
    });

    it('rechaza montos con más de dos decimales', () => {
      const res = parseSolesToCentavos('10.999');
      expect(res.ok).toBe(false);
    });

    it('rechaza cadenas alfanuméricas o caracteres inválidos', () => {
      expect(parseSolesToCentavos('abc').ok).toBe(false);
      expect(parseSolesToCentavos('12,50').ok).toBe(false);
      expect(parseSolesToCentavos('NaN').ok).toBe(false);
      expect(parseSolesToCentavos('Infinity').ok).toBe(false);
    });

    it('rechaza importes que superan el límite máximo seguro', () => {
      const huge = '10000000000.00';
      const res = parseSolesToCentavos(huge);
      expect(res.ok).toBe(false);
    });
  });

  describe('toDecimalString & formatMoneda', () => {
    it('formatea céntimos a representación decimal exacta para base de datos', () => {
      expect(toDecimalString(1990 as Centavos)).toBe('19.90');
      expect(toDecimalString(50 as Centavos)).toBe('0.50');
      expect(toDecimalString(500 as Centavos)).toBe('5.00');
      expect(toDecimalString(0 as Centavos)).toBe('0.00');
    });

    it('formatea céntimos a moneda de mostrador S/', () => {
      expect(formatMoneda(1990 as Centavos)).toBe('S/ 19.90');
      expect(formatMoneda(50 as Centavos)).toBe('S/ 0.50');
    });
  });

  describe('Aritmética de Céntimos (sumCentavos, subtractCentavos)', () => {
    it('suma importes de forma determinista y segura', () => {
      const a = 1990 as Centavos;
      const b = 500 as Centavos;
      const res = sumCentavos(a, b);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe(2490);
    });

    it('resta importes correctamente', () => {
      const total = 2500 as Centavos;
      const abono = 1000 as Centavos;
      const saldo = subtractCentavos(total, abono);
      expect(saldo.ok).toBe(true);
      if (saldo.ok) expect(saldo.value).toBe(1500);
    });
  });
});
