/**
 * @tienda/database - migrations.ts
 * Motor de migraciones locales repetibles y versionadas para SQLite.
 * Trazabilidad: ARQUITECTURA.md §4.2, MODELO_DATOS.md §2.3
 */

import type { SqliteDriver } from './types.js';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: (db: SqliteDriver) => Promise<void>;
}

export const INITIAL_SYNC_MIGRATION: Migration = {
  version: 1,
  name: '001_initial_sync_schema',
  up: async (db: SqliteDriver) => {
    // 1. Tabla de cola local de mutaciones (Outbox)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
        payload TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'synced', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sync_outbox_status_created ON sync_outbox(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_sync_outbox_idempotency ON sync_outbox(idempotency_key);

      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};

export const CORE_MIGRATIONS: readonly Migration[] = [INITIAL_SYNC_MIGRATION];

export class MigrationRunner {
  constructor(private readonly db: SqliteDriver) {}

  /**
   * Inicializa la tabla de control de versiones de migraciones si no existe.
   */
  async initMigrationTable(): Promise<void> {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  /**
   * Obtiene la lista de versiones ya aplicadas.
   */
  async getAppliedVersions(): Promise<number[]> {
    await this.initMigrationTable();
    const rows = await this.db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC;',
    );
    return rows.map((r) => r.version);
  }

  /**
   * Ejecuta todas las migraciones pendientes de forma atómica y repetible.
   */
  async runMigrations(migrations: readonly Migration[] = CORE_MIGRATIONS): Promise<{ applied: number }> {
    await this.initMigrationTable();
    const appliedVersions = await this.getAppliedVersions();
    let appliedCount = 0;

    for (const migration of migrations) {
      if (appliedVersions.includes(migration.version)) {
        continue;
      }

      await this.db.withExclusiveTransactionAsync(async () => {
        await migration.up(this.db);
        const now = new Date().toISOString();
        await this.db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          migration.version,
          migration.name,
          now,
        );
      });

      appliedCount++;
    }

    return { applied: appliedCount };
  }
}
