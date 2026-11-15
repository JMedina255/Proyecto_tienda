/**
 * @tienda/business-logic - result.ts
 * Patrón funcional Result para manejo determinista de operaciones de dominio sin excepciones no controladas.
 * Trazabilidad: ESTANDAR_PROGRAMACION.md §5.2
 */

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
