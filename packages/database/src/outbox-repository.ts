/**
 * @tienda/database - outbox-repository.ts
 * Repositorio local para la cola Outbox transaccional de mutaciones en SQLite.
 * Trazabilidad: ARQUITECTURA.md §6.2, MODELO_DATOS.md §2.3, DEC-012
 */

import type { SyncMutation, SyncStatus, SyncOperation } from '@tienda/shared-types';
import type { SqliteTransactionDriver } from './types.js';

interface OutboxRow {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperation;
  payload: string;
  idempotency_key: string;
  status: SyncStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export class OutboxRepository {
  constructor(private readonly db: SqliteTransactionDriver) {}

  /**
   * Encola una nueva mutación en la tabla sync_outbox.
   * Si se pasa un objeto transaccional customDb (txn), la inserción se ejecuta
   * dentro de dicho contexto atómico.
   * Si ya existe la clave de idempotencia, lanza error de restricción UNIQUE.
   */
  async enqueue(mutation: SyncMutation, customDb?: SqliteTransactionDriver): Promise<void> {
    const targetDb = customDb ?? this.db;
    const payloadJson = JSON.stringify(mutation.payload);
    const now = mutation.createdAt || new Date().toISOString();

    await targetDb.runAsync(
      `INSERT INTO sync_outbox (
        id, entity_type, entity_id, operation, payload, idempotency_key,
        status, retry_count, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      mutation.id,
      mutation.entityType,
      mutation.entityId,
      mutation.operation,
      payloadJson,
      mutation.idempotencyKey,
      mutation.status || 'pending',
      mutation.retryCount || 0,
      mutation.lastError || null,
      now,
      now,
    );
  }

  /**
   * Obtiene las mutaciones pendientes de envío ordenadas por fecha de creación (FIFO).
   */
  async getPending(limit = 50): Promise<SyncMutation[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      `SELECT * FROM sync_outbox
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?;`,
      limit,
    );

    return rows.map((row) => this.mapRowToMutation(row));
  }

  /**
   * Marca una lista de mutaciones como 'in_progress'.
   */
  async markInProgress(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');

    await this.db.runAsync(
      `UPDATE sync_outbox
       SET status = 'in_progress', updated_at = ?
       WHERE id IN (${placeholders});`,
      now,
      ...ids,
    );
  }

  /**
   * Recupera mutaciones que quedaron huérfanas en estado 'in_progress' debido a
   * un cierre forzado o reinicio inesperado de la aplicación, retornándolas a 'pending'.
   */
  async resetInProgressToPending(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db.runAsync(
      `UPDATE sync_outbox
       SET status = 'pending', updated_at = ?
       WHERE status = 'in_progress';`,
      now,
    );
    return result.changes;
  }

  /**
   * Marca mutaciones como sincronizadas ('synced').
   */
  async markSynced(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');

    await this.db.runAsync(
      `UPDATE sync_outbox
       SET status = 'synced', updated_at = ?
       WHERE id IN (${placeholders});`,
      now,
      ...ids,
    );
  }

  /**
   * Marca una mutación fallida, incrementando el contador de reintentos y registrando el error.
   */
  async markFailed(id: string, error: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db.runAsync(
      `UPDATE sync_outbox
       SET status = 'pending', retry_count = retry_count + 1, last_error = ?, updated_at = ?
       WHERE id = ?;`,
      error,
      now,
      id,
    );
  }

  /**
   * Comprueba si una clave de idempotencia ya fue registrada previamente en la cola local.
   */
  async hasIdempotencyKey(key: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_outbox WHERE idempotency_key = ?;',
      key,
    );
    return (row?.count ?? 0) > 0;
  }

  /**
   * Retorna el conteo total de mutaciones pendientes de envío.
   */
  async countPending(): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending';",
    );
    return row?.count ?? 0;
  }

  private mapRowToMutation(row: OutboxRow): SyncMutation {
    let payloadParsed: Record<string, unknown> = {};
    try {
      payloadParsed = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payloadParsed = { raw: row.payload };
    }

    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: payloadParsed,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      retryCount: row.retry_count,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
