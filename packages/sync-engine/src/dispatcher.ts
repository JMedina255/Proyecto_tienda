/**
 * @tienda/sync-engine - dispatcher.ts
 * Despachador de sincronización Outbox hacia RPCs de Supabase con resiliencia a caídas de red.
 * Trazabilidad: ARQUITECTURA.md §6.2, DEC-012, SEC-SYNC-001
 */

import type { OutboxRepository } from '@tienda/database';
import type { SyncBatchRequest } from '@tienda/shared-types';
import type { SupabaseSyncClient } from './rpc-client.js';

export interface DispatcherConfig {
  readonly dispositivoId: string;
  readonly usuarioId: string;
  readonly appVersion: string;
  readonly batchSize?: number;
}

export class SyncDispatcher {
  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly rpcClient: SupabaseSyncClient,
    private readonly config: DispatcherConfig,
  ) {}

  /**
   * Procesa un lote de mutaciones pendientes desde la cola Outbox local y las transmite al servidor.
   */
  async dispatchPending(limit = this.config.batchSize ?? 50): Promise<{ processed: number; failed: number }> {
    const pendingMutations = await this.outboxRepo.getPending(limit);
    if (pendingMutations.length === 0) {
      return { processed: 0, failed: 0 };
    }

    const ids = pendingMutations.map((m) => m.id);
    await this.outboxRepo.markInProgress(ids);

    const batchRequest: SyncBatchRequest = {
      dispositivoId: this.config.dispositivoId,
      usuarioId: this.config.usuarioId,
      appVersion: this.config.appVersion,
      mutations: pendingMutations,
    };

    try {
      const response = await this.rpcClient.pushMutations(batchRequest);

      let processed = 0;
      let failed = 0;
      const handledIds = new Set<string>();

      for (const result of response.results) {
        const mutation = pendingMutations.find((m) => m.idempotencyKey === result.idempotencyKey);
        if (!mutation) continue;
        handledIds.add(mutation.id);

        if (result.success && (result.status === 'processed' || result.status === 'already_applied')) {
          await this.outboxRepo.markSynced([mutation.id]);
          processed++;
        } else {
          await this.outboxRepo.markFailed(
            mutation.id,
            result.error || `Mutación rechazada por el servidor con estado: ${result.status}`,
          );
          failed++;
        }
      }

      // Protección contra respuestas incompletas: mutaciones no informadas por el servidor
      const unhandled = pendingMutations.filter((m) => !handledIds.has(m.id));
      for (const unhandledMutation of unhandled) {
        await this.outboxRepo.markFailed(
          unhandledMutation.id,
          'Respuesta incompleta: la mutación enviada no fue incluida en el resultado del servidor',
        );
        failed++;
      }

      return { processed, failed };
    } catch (networkError) {
      // Ante fallo de red o caída de conexión, no se pierde ninguna mutación:
      // se devuelven al estado 'pending' incrementando el reintento
      const errorMessage = networkError instanceof Error ? networkError.message : 'Fallo de comunicación de red';
      for (const id of ids) {
        await this.outboxRepo.markFailed(id, errorMessage);
      }

      return { processed: 0, failed: ids.length };
    }
  }
}
