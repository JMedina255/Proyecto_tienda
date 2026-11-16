/**
 * @tienda/shared-types - sync.ts
 * Contratos de sincronización asíncrona Offline-First, cola Outbox e idempotencia.
 * Trazabilidad: ARQUITECTURA.md §6, DEC-012, MODELO_DATOS.md §2.3
 */

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export type SyncStatus = 'pending' | 'in_progress' | 'synced' | 'failed';

export type MutationSyncStatus = 'processed' | 'already_applied' | 'rejected' | 'failed';

export interface SyncMutation<TPayload = Record<string, unknown>> {
  readonly id: string; // UUID v4 único de la mutación local
  readonly entityType: string; // ej. 'sync_test', 'ventas', 'pagos_venta', etc.
  readonly entityId: string; // UUID de la entidad afectada
  readonly operation: SyncOperation;
  readonly payload: TPayload;
  readonly idempotencyKey: string; // SHA-256 (64 hex characters)
  readonly status: SyncStatus;
  readonly retryCount: number;
  readonly lastError: string | null;
  readonly createdAt: string; // ISO-8601 UTC
  readonly updatedAt?: string;
}

export interface SyncBatchRequest {
  readonly dispositivoId: string;
  readonly appVersion: string;
  readonly mutations: readonly SyncMutation[];
  readonly usuarioId?: string; // Opcional / metadato; el servidor valida y asigna estrictamente auth.uid() de GoTrue
}

export interface SyncProcessedResult {
  readonly idempotencyKey: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly status: MutationSyncStatus;
  readonly success: boolean; // true si status es 'processed' o 'already_applied'
  readonly error?: string;
  readonly serverTimestamp: string;
}

export interface SyncBatchResponse {
  readonly success: boolean;
  readonly processedCount: number;
  readonly alreadyAppliedCount: number;
  readonly failedCount: number;
  readonly results: readonly SyncProcessedResult[];
}

export interface SyncMetadata {
  readonly dispositivoId: string;
  readonly lastSyncAt: string | null;
  readonly pendingCount: number;
}
