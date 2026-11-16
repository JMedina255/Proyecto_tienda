/**
 * @tienda/database - expo-driver.ts
 * Adaptador del contrato SqliteDriver para el motor nativo expo-sqlite en Android/iOS.
 * Implementa serialización mediante AsyncTransactionMutex y BEGIN IMMEDIATE sobre la conexión principal,
 * garantizando cumplimiento estricto de PRAGMA foreign_keys = ON y atomicidad en Expo SDK 52+.
 * Trazabilidad: ARQUITECTURA.md §4.2, MODELO_DATOS.md §1.7, DEC-012
 */

import type { SqliteDriver, SqliteTransactionDriver, RunResult, ExpoSqliteDatabaseLike } from './types.js';

/**
 * Mutex asíncrono para serializar transacciones en el hilo de JavaScript,
 * evitando concurrencia de escrituras y preservando el estado de los PRAGMAs
 * de la conexión principal.
 */
class AsyncTransactionMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousLock = this.queue;
    this.queue = this.queue.then(() => currentLock);

    await previousLock;
    try {
      return await task();
    } finally {
      releaseLock!();
    }
  }
}

export class ExpoSqliteDriver implements SqliteDriver {
  private readonly mutex = new AsyncTransactionMutex();

  constructor(private readonly db: ExpoSqliteDatabaseLike) {}

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<RunResult> {
    const result = await this.db.runAsync(sql, ...params);
    return {
      lastInsertRowId: result.lastInsertRowId,
      changes: result.changes,
    };
  }

  async getFirstAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T | null> {
    return await this.db.getFirstAsync<T>(sql, ...params);
  }

  async getAllAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]> {
    return await this.db.getAllAsync<T>(sql, ...params);
  }

  async withTransactionAsync<T = void>(task: (txn: SqliteTransactionDriver) => Promise<T>): Promise<T> {
    return await this.mutex.runExclusive(async () => {
      if (typeof this.db.withTransactionAsync === 'function') {
        let result: T | undefined;
        await this.db.withTransactionAsync(async () => {
          result = await task(this);
        });
        return result as T;
      }

      await this.db.execAsync('BEGIN;');
      try {
        const result = await task(this);
        await this.db.execAsync('COMMIT;');
        return result;
      } catch (err) {
        try {
          await this.db.execAsync('ROLLBACK;');
        } catch {
          // Ignorar fallo secundario de rollback si la conexión fue cerrada
        }
        throw err;
      }
    });
  }

  async withExclusiveTransactionAsync<T = void>(task: (txn: SqliteTransactionDriver) => Promise<T>): Promise<T> {
    return await this.mutex.runExclusive(async () => {
      // Ejecución de BEGIN IMMEDIATE sobre la conexión principal serializada.
      // Garantiza:
      // 1. Integridad referencial estricta: PRAGMA foreign_keys = ON se mantiene activo.
      // 2. Atomicidad financiera: commit o rollback coordinado de todas las operaciones.
      // 3. Bloqueo inmediato de escritura sin subconexiones aisladas de Expo.
      await this.db.execAsync('BEGIN IMMEDIATE;');
      try {
        const result = await task(this);
        await this.db.execAsync('COMMIT;');
        return result;
      } catch (err) {
        try {
          await this.db.execAsync('ROLLBACK;');
        } catch {
          // Preservar excepción original
        }
        throw err;
      }
    });
  }

  async closeAsync(): Promise<void> {
    if (typeof this.db.closeAsync === 'function') {
      await this.db.closeAsync();
    }
  }
}
