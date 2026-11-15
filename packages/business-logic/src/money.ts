/**
 * @tienda/business-logic - money.ts
 * Utilidades puras de conversión y aritmética monetaria determinista.
 * Erradica imprecisiones de coma flotante binaria IEEE 754 operando estrictamente en céntimos enteros.
 * Trazabilidad: ESTANDAR_PROGRAMACION.md §1.3, MODELO_DATOS.md §1.8
 */

import { type Result, ok, err } from './result.js';

export type Centavos = number & { readonly __brand: unique symbol };

/**
 * Límite máximo seguro para transacciones en mostrador (S/ 10,000,000.00 = 1,000,000,000 céntimos).
 * Muy por debajo de Number.MAX_SAFE_INTEGER (9,007,199,254,740,991).
 */
export const MAX_SAFE_CENTAVOS = 1_000_000_000 as Centavos;

/**
 * Parsea de forma segura una cadena monetaria a céntimos enteros sin operar en punto flotante.
 * Acepta formatos: "19.90", "5", "0.50", "120.5", etc.
 */
export const parseSolesToCentavos = (input: string): Result<Centavos, string> => {
  if (typeof input !== 'string') {
    return err('Entrada inválida. Se requiere una cadena de texto.');
  }

  const clean = input.trim();
  if (clean.length === 0) {
    return err('El monto no puede estar vacío.');
  }

  // Valida que sea un número positivo con hasta dos decimales
  const match = clean.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match || !match[1]) {
    return err('Formato numérico inválido. Ingrese un número positivo con hasta dos decimales (ej. 19.90).');
  }

  const enteros = parseInt(match[1], 10);
  const decimalesRaw = match[2] ?? '';
  const decimales = parseInt(decimalesRaw.padEnd(2, '0'), 10);

  if (!Number.isSafeInteger(enteros)) {
    return err('El importe entero excede el límite numérico seguro.');
  }

  const totalCentavos = enteros * 100 + decimales;

  if (totalCentavos > MAX_SAFE_CENTAVOS) {
    return err('El importe excede el límite máximo permitido por operación.');
  }

  return ok(totalCentavos as Centavos);
};

/**
 * Convierte céntimos enteros a cadena decimal exacta para persistencia en PostgreSQL o cálculos.
 * Ej. 1990 -> "19.90", 50 -> "0.50", 500 -> "5.00".
 */
export const toDecimalString = (centavos: Centavos): string => {
  const sign = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const enteros = Math.floor(abs / 100);
  const dec = (abs % 100).toString().padStart(2, '0');
  return `${sign}${enteros}.${dec}`;
};

/**
 * Formatea céntimos enteros a moneda local para presentación en pantalla de mostrador.
 * Ej. 1990 -> "S/ 19.90".
 */
export const formatMoneda = (centavos: Centavos): string => {
  return `S/ ${toDecimalString(centavos)}`;
};

/**
 * Suma dos o más importes en céntimos garantizando que el resultado sea seguro.
 */
export const sumCentavos = (...amounts: Centavos[]): Result<Centavos, string> => {
  let total = 0;
  for (const amt of amounts) {
    total += amt;
    if (!Number.isSafeInteger(total)) {
      return err('Desbordamiento numérico al calcular la suma en céntimos.');
    }
  }
  return ok(total as Centavos);
};

/**
 * Resta dos importes en céntimos.
 */
export const subtractCentavos = (a: Centavos, b: Centavos): Result<Centavos, string> => {
  const diff = a - b;
  if (!Number.isSafeInteger(diff)) {
    return err('Desbordamiento numérico al restar importes en céntimos.');
  }
  return ok(diff as Centavos);
};
