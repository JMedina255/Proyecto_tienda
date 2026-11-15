/**
 * @tienda/business-logic - validation.ts
 * Esquemas Zod para validación rigurosa en fronteras de entrada y datos de sincronización.
 * Trazabilidad: ESTANDAR_PROGRAMACION.md §5.1, SEC-INP-001
 */

import { z } from 'zod';

export const UuidSchema = z.string().uuid({
  message: 'Debe ser un identificador UUID v4 válido.',
});

export const IdempotencyKeySchema = z
  .string()
  .length(64, { message: 'La clave de idempotencia debe ser un hash SHA-256 de 64 caracteres hexadecimales.' })
  .regex(/^[a-f0-9]{64}$/i, { message: 'Formato SHA-256 hexadecimal inválido.' });

export const CentavosSchema = z
  .number()
  .int({ message: 'El importe monetario debe ser un número entero en céntimos.' })
  .nonnegative({ message: 'El importe monetario no puede ser negativo.' });

export const SyncMutationSchema = z.object({
  id: UuidSchema,
  entityType: z.string().min(1).max(50),
  entityId: UuidSchema,
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  payload: z.record(z.unknown()),
  idempotencyKey: IdempotencyKeySchema,
  status: z.enum(['pending', 'in_progress', 'synced', 'failed']),
  retryCount: z.number().int().nonnegative().default(0),
  lastError: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});
