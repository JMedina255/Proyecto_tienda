/**
 * @tienda/sync-engine - rpc-client.ts
 * Cliente tipado para contratos de RPC en Supabase y cliente simulado para pruebas locales offline.
 * Trazabilidad: ARQUITECTURA.md §4.2, SEC-SYNC-001, SEC-SYNC-003
 */

import type { SyncBatchRequest, SyncBatchResponse, SyncProcessedResult } from '@tienda/shared-types';

export interface SupabaseSyncClient {
  /**
   * Invoca la función RPC remota sync_push_mutations en PostgreSQL.
   */
  pushMutations(request: SyncBatchRequest): Promise<SyncBatchResponse>;
}

export type NetworkSimulationMode = 'online' | 'offline' | 'flaky';

/**
 * Cliente RPC simulado para desarrollo local y pruebas automatizadas sin conexión física a Supabase.
 * Permite validar idempotencia por hash, reintentos y tolerancia a caídas de red.
 */
export class SimulatedSupabaseRpcClient implements SupabaseSyncClient {
  private readonly processedKeys = new Set<string>();
  private networkMode: NetworkSimulationMode = 'online';

  setNetworkMode(mode: NetworkSimulationMode): void {
    this.networkMode = mode;
  }

  getProcessedKeysCount(): number {
    return this.processedKeys.size;
  }

  isKeyProcessed(key: string): boolean {
    return this.processedKeys.has(key);
  }

  async pushMutations(request: SyncBatchRequest): Promise<SyncBatchResponse> {
    if (this.networkMode === 'offline') {
      throw new Error('Fallo de red simulado: dispositivo sin conexión a internet (modo offline).');
    }

    if (this.networkMode === 'flaky' && Math.random() < 0.5) {
      throw new Error('Fallo de red intermitente simulado (timeout / error 503).');
    }

    const results: SyncProcessedResult[] = [];
    const serverTimestamp = new Date().toISOString();
    let processedCount = 0;
    let alreadyAppliedCount = 0;
    let failedCount = 0;

    for (const mutation of request.mutations) {
      // 1. Rechazo explícito de entidades de negocio no implementadas todavía en H06
      if (mutation.entityType !== 'sync_test') {
        failedCount++;
        results.push({
          idempotencyKey: mutation.idempotencyKey,
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          status: 'rejected',
          success: false,
          error: `Entidad aún no implementada en el servidor (planeada para H07+): ${mutation.entityType}`,
          serverTimestamp,
        });
        continue;
      }

      // 2. Reintento idempotente: ya procesada con anterioridad
      if (this.processedKeys.has(mutation.idempotencyKey)) {
        alreadyAppliedCount++;
        results.push({
          idempotencyKey: mutation.idempotencyKey,
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          status: 'already_applied',
          success: true,
          serverTimestamp,
        });
      } else {
        // 3. Procesamiento y persistencia exitosa
        this.processedKeys.add(mutation.idempotencyKey);
        processedCount++;
        results.push({
          idempotencyKey: mutation.idempotencyKey,
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          status: 'processed',
          success: true,
          serverTimestamp,
        });
      }
    }

    return {
      success: true,
      processedCount,
      alreadyAppliedCount,
      failedCount,
      results,
    };
  }
}
