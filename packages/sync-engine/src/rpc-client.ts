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

    for (const mutation of request.mutations) {
      if (this.processedKeys.has(mutation.idempotencyKey)) {
        // Idempotencia: el servidor detecta que ya fue procesada y responde éxito sin duplicar
        results.push({
          idempotencyKey: mutation.idempotencyKey,
          success: true,
          serverTimestamp,
        });
      } else {
        // Procesamiento exitoso
        this.processedKeys.add(mutation.idempotencyKey);
        results.push({
          idempotencyKey: mutation.idempotencyKey,
          success: true,
          serverTimestamp,
        });
      }
    }

    return {
      processedCount: results.filter((r) => r.success).length,
      results,
    };
  }
}
