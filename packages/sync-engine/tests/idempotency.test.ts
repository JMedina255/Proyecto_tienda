import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, isValidIdempotencyKey } from '../src/idempotency.js';

describe('Generador y Validador de Idempotencia (idempotency.ts)', () => {
  const baseParams = {
    dispositivoId: 'disp-001',
    entityType: 'ventas',
    entityId: 'venta-100',
    operation: 'INSERT',
    timestamp: '2026-11-15T18:00:00.000Z',
    payload: { totalNeto: 2500, serie: 'NV01', correlativo: 1 },
  };

  it('genera una clave determinista SHA-256 de exactamente 64 caracteres hexadecimales', () => {
    const key1 = generateIdempotencyKey(baseParams);
    const key2 = generateIdempotencyKey(baseParams);

    expect(key1).toBe(key2);
    expect(key1.length).toBe(64);
    expect(isValidIdempotencyKey(key1)).toBe(true);
  });

  it('produce hashes distintos si cambia cualquier parámetro de la mutación', () => {
    const keyOriginal = generateIdempotencyKey(baseParams);

    const keyDifferentTime = generateIdempotencyKey({
      ...baseParams,
      timestamp: '2026-11-15T18:00:01.000Z',
    });
    expect(keyOriginal).not.toBe(keyDifferentTime);

    const keyDifferentEntity = generateIdempotencyKey({
      ...baseParams,
      entityId: 'venta-101',
    });
    expect(keyOriginal).not.toBe(keyDifferentEntity);

    const keyDifferentOperation = generateIdempotencyKey({
      ...baseParams,
      operation: 'UPDATE',
    });
    expect(keyOriginal).not.toBe(keyDifferentOperation);
  });

  it('valida correctamente formatos de clave de idempotencia', () => {
    expect(isValidIdempotencyKey('a'.repeat(64))).toBe(true);
    expect(isValidIdempotencyKey('0123456789abcdef'.repeat(4))).toBe(true);

    expect(isValidIdempotencyKey('demasiado-corta')).toBe(false);
    expect(isValidIdempotencyKey('z'.repeat(64))).toBe(false); // 'z' no es hex
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey(12345)).toBe(false);
  });
});
