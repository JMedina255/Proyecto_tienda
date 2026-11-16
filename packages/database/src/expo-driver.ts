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

/**
 * Contexto de ejecución transaccional directa sobre la conexión principal.
 * Se utiliza exclusivamente dentro de un callback transaccional protegido por el mutex,
 * permitiendo ejecutar sentencias DML/DQL sin re-adquirir el mutex para evitar interbloqueos.
 */
class ExpoTransactionContextDriver implements SqliteTransactionDriver {
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
}

export class ExpoSqliteDriver implements SqliteDriver {
  private readonly mutex = new AsyncTransactionMutex();

  constructor(private readonly db: ExpoSqliteDatabaseLike) {}

  /**
   * Ejecuta sentencias DDL o scripts protegiéndolos mediante el mutex,
   * impidiendo que escrituras externas se intercalen dentro de una transacción activa.
   */
  async execAsync(sql: string): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.db.execAsync(sql);
    });
  }

  /**
   * Ejecuta sentencias DML adquiriendo el mutex para evitar que escrituras aisladas
   * se incorporen accidentalmente a una transacción abierta por otro flujo.
   */
  async runAsync(sql: string, ...params: unknown[]): Promise<RunResult> {
    return await this.mutex.runExclusive(async () => {
      const result = await this.db.runAsync(sql, ...params);
      return {
        lastInsertRowId: result.lastInsertRowId,
        changes: result.changes,
      };
    });
  }

  async getFirstAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T | null> {
    return await this.db.getFirstAsync<T>(sql, ...params);
  }

  async getAllAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]> {
    return await this.db.getAllAsync<T>(sql, ...params);
  }

  async withTransactionAsync<T = void>(task: (txn: SqliteTransactionDriver) => Promise<T>): Promise<T> {
    return await this.mutex.runExclusive(async () => {
      const txn = new ExpoTransactionContextDriver(this.db);
      if (typeof this.db.withTransactionAsync === 'function') {
        let result: T | undefined;
        await this.db.withTransactionAsync(async () => {
          result = await task(txn);
        });
        return result as T;
      }

      await this.db.execAsync('BEGIN;');
      try {
        const result = await task(txn);
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
      const txn = new ExpoTransactionContextDriver(this.db);
      // Ejecución de BEGIN IMMEDIATE sobre la conexión principal serializada.
      // Garantiza:
      // 1. Integridad referencial estricta: PRAGMA foreign_keys = ON se mantiene activo.
      // 2. Atomicidad financiera: commit o rollback coordinado de todas las operaciones.
      // 3. Aislamiento total: cualquier escritura externa vía driver.runAsync espera la liberación del mutex.
      await this.db.execAsync('BEGIN IMMEDIATE;');
      try {
        const result = await task(txn);
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
