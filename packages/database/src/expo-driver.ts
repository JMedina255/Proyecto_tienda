/**
 * @tienda/database - expo-driver.ts
 * Adaptador del contrato SqliteDriver para el motor nativo expo-sqlite en Android/iOS.
 * Trazabilidad: ARQUITECTURA.md §4.2, MODELO_DATOS.md §1.7, DEC-012
 */

import type { SqliteDriver, RunResult, ExpoSqliteDatabaseLike } from './types.js';

export class ExpoSqliteDriver implements SqliteDriver {
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

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await this.db.withTransactionAsync(task);
  }

  async withExclusiveTransactionAsync(task: () => Promise<void>): Promise<void> {
    await this.db.withExclusiveTransactionAsync(task);
  }

  async closeAsync(): Promise<void> {
    await this.db.closeAsync();
  }
}
