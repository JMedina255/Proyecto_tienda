/**
 * @tienda/shared-types - rpc.ts
 * Contratos tipados para invocaciones RPC seguras hacia Supabase (PostgreSQL).
 * Trazabilidad: ARQUITECTURA.md §4.2, SEC-SYNC-003, DEC-012
 */

import type { SyncBatchRequest, SyncBatchResponse } from './sync.js';

export interface SupabaseRpcContracts {
  /**
   * RPC: sync_push_mutations
   * Procesa un lote de mutaciones Outbox con verificación de idempotencia y permisos por rol.
   */
  sync_push_mutations: {
    args: {
      p_batch: SyncBatchRequest;
    };
    returns: SyncBatchResponse;
  };

  /**
   * RPC: conciliar_caja_offline
   * Evalúa y concilia el cierre de caja provisorio calculando la diferencia de efectivo.
   */
  conciliar_caja_offline: {
    args: {
      p_sesion_caja_id: string;
      p_monto_declarado_centavos: number;
    };
    returns: {
      ok: boolean;
      diferenciaCentavos: number;
      estadoResultante: string;
    };
  };
}
