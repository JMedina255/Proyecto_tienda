import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BetterSqliteDriver } from '../src/test-driver.js';
import { initializeDatabasePragmas } from '../src/connection.js';
import { MigrationRunner, CORE_MIGRATIONS } from '../src/migrations.js';

describe('Motor de Migraciones y Conexión SQLite (migrations.ts, connection.ts)', () => {
  let db: BetterSqliteDriver;

  beforeEach(() => {
    db = new BetterSqliteDriver(':memory:');
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('inicializa correctamente los pragmas de integridad y durabilidad', async () => {
    await initializeDatabasePragmas(db, {
      name: ':memory:',
      journalMode: 'WAL',
      synchronous: 'FULL',
      foreignKeys: true,
    });

    const fkResult = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys;');
    expect(fkResult?.foreign_keys).toBe(1);

    // En bases en memoria :memory:, journal_mode suele ser 'memory', pero se prueba la ejecución del comando
    const syncResult = await db.getFirstAsync<{ synchronous: number }>('PRAGMA synchronous;');
    expect(syncResult?.synchronous).toBe(2); // 2 = FULL
  });

  it('ejecuta las migraciones iniciales creando las tablas requeridas', async () => {
    const runner = new MigrationRunner(db);
    const result = await runner.runMigrations(CORE_MIGRATIONS);

    expect(result.applied).toBe(1);

    const appliedVersions = await runner.getAppliedVersions();
    expect(appliedVersions).toEqual([1]);

    // Verificar que la tabla sync_outbox existe consultando su esquema
    const tableInfo = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_outbox';",
    );
    expect(tableInfo.length).toBe(1);
    expect(tableInfo[0]?.name).toBe('sync_outbox');
  });

  it('es idempotente: una segunda ejecución no re-aplica migraciones ya registradas', async () => {
    const runner = new MigrationRunner(db);
    const firstRun = await runner.runMigrations(CORE_MIGRATIONS);
    expect(firstRun.applied).toBe(1);

    const secondRun = await runner.runMigrations(CORE_MIGRATIONS);
    expect(secondRun.applied).toBe(0);

    const appliedVersions = await runner.getAppliedVersions();
    expect(appliedVersions).toEqual([1]);
  });
});
