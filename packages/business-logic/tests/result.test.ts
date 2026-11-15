import { describe, it, expect } from 'vitest';
import { ok, err } from '../src/result.js';

describe('Patrón Result (result.ts)', () => {
  it('crea un resultado exitoso correctamente', () => {
    const res = ok(42);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe(42);
    }
  });

  it('crea un resultado de error correctamente', () => {
    const res = err('Fallo de operación');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Fallo de operación');
    }
  });
});
