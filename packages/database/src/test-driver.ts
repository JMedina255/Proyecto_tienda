/**
 * @tienda/database - test-driver.ts
 * Implementación de SqliteDriver respaldada por SQLite real en memoria/fichero
 * para pruebas unitarias, de integración y verificación de esquemas en Node/Vitest.
 * Trazabilidad: ESTANDAR_PROGRAMACION.md §4.1, §6
 */

import Database, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { SqliteDriver, RunResult } from './types.js';

export class BetterSqliteDriver implements SqliteDriver {
  private db: BetterSqliteDatabase | null;

  constructor(filename = ':memory:') {
    this.db = new Database(filename);
  }

  private getDb(): BetterSqliteDatabase {
    if (!this.db) {
      throw new Error('La base de datos SQLite se encuentra cerrada.');
    }
    return this.db;
  }

  async execAsync(sql: string): Promise<void> {
    this.getDb().exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<RunResult> {
    const stmt = this.getDb().prepare(sql);
    const info = stmt.run(...params);
    return {
      lastInsertRowId: Number(info.lastInsertRowid),
      changes: info.changes,
    };
  }

  async getFirstAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T | null> {
    const stmt = this.getDb().prepare(sql);
    const row = stmt.get(...params) as T | undefined;
    return row ?? null;
  }

  async getAllAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this.getDb().prepare(sql);
    return stmt.all(...params) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const db = this.getDb();
    db.exec('BEGIN DEFERRED;');
    try {
      await task();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  async withExclusiveTransactionAsync(task: () => Promise<void>): Promise<void> {
    const db = this.getDb();
    // Bloqueo reservado de escritura inmediato (BEGIN IMMEDIATE) para evitar interrupciones o SQLITE_BUSY
    db.exec('BEGIN IMMEDIATE;');
    try {
      await task();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  async closeAsync(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
