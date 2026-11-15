import { describe, it, expect } from 'vitest';
import { calculateBackoffDelayMs, DEFAULT_BACKOFF_CONFIG } from '../src/backoff.js';

describe('Cálculo de Retroceso Exponencial con Jitter (backoff.ts)', () => {
  it('retorna 0 ms para retryCount 0', () => {
    expect(calculateBackoffDelayMs(0)).toBe(0);
    expect(calculateBackoffDelayMs(-1)).toBe(0);
  });

  it('aumenta progresivamente el tiempo de espera a mayor número de reintentos', () => {
    const delay1 = calculateBackoffDelayMs(1, { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 });
    const delay2 = calculateBackoffDelayMs(2, { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 });
    const delay3 = calculateBackoffDelayMs(3, { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 });

    expect(delay1).toBe(1000); // 1s
    expect(delay2).toBe(2000); // 2s
    expect(delay3).toBe(4000); // 4s
    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('respeta el límite máximo configurado (maxDelayMs)', () => {
    const delayHuge = calculateBackoffDelayMs(50, { ...DEFAULT_BACKOFF_CONFIG, jitterFactor: 0 });
    expect(delayHuge).toBe(DEFAULT_BACKOFF_CONFIG.maxDelayMs);
  });
});
