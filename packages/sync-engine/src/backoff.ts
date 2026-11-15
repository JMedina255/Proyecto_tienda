/**
 * @tienda/sync-engine - backoff.ts
 * Cálculo de retroceso exponencial con variación aleatoria (jitter) para reintentos de red.
 * Trazabilidad: ARQUITECTURA.md §6.2, ESTANDAR_PROGRAMACION.md §5.2
 */

export interface BackoffConfig {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
  readonly jitterFactor: number;
}

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelayMs: 1000, // 1 segundo
  maxDelayMs: 300000, // 5 minutos máximo
  multiplier: 2,
  jitterFactor: 0.2, // 20% jitter
};

/**
 * Calcula el tiempo de espera en milisegundos para el siguiente reintento.
 * delay = min(maxDelay, initialDelay * (multiplier ^ retryCount)) +/- jitter
 */
export const calculateBackoffDelayMs = (
  retryCount: number,
  config: BackoffConfig = DEFAULT_BACKOFF_CONFIG,
): number => {
  if (retryCount <= 0) return 0;

  const exponential = config.initialDelayMs * Math.pow(config.multiplier, retryCount - 1);
  const capped = Math.min(exponential, config.maxDelayMs);

  // Variación aleatoria para desincronizar reintentos simultáneos (anti-thundering herd)
  const jitterRange = capped * config.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return Math.max(config.initialDelayMs, Math.round(capped + jitter));
};
