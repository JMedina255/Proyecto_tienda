/**
 * @tienda/sync-engine - idempotency.ts
 * Generador y validador determinista de claves de idempotencia SHA-256 para mutaciones Outbox.
 * Trazabilidad: ARQUITECTURA.md §6.3, MODELO_DATOS.md §1.3, SEC-SYNC-002
 */

import { createHash } from 'node:crypto';

export interface IdempotencyParams {
  readonly dispositivoId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: string;
  readonly timestamp: string;
  readonly payload?: unknown;
}

/**
 * Genera una clave de idempotencia única basada en el hash SHA-256
 * de los parámetros canónicos de la mutación.
 */
export const generateIdempotencyKey = (params: IdempotencyParams): string => {
  const normalizedPayload = params.payload ? JSON.stringify(params.payload) : '';
  const canonicalString = [
    params.dispositivoId.trim().toLowerCase(),
    params.entityType.trim().toLowerCase(),
    params.entityId.trim().toLowerCase(),
    params.operation.trim().toUpperCase(),
    params.timestamp.trim(),
    normalizedPayload,
  ].join(':');

  return createHash('sha256').update(canonicalString, 'utf8').digest('hex');
};

/**
 * Valida si una cadena cumple con el formato estándar de clave de idempotencia SHA-256.
 */
export const isValidIdempotencyKey = (key: unknown): boolean => {
  if (typeof key !== 'string') return false;
  return /^[a-f0-9]{64}$/i.test(key.trim());
};
