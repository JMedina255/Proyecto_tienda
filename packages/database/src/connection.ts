/**
 * @tienda/database - connection.ts
 * Gestor de inicialización y pragmas de durabilidad de SQLite para el Sistema de Gestión de Librería.
 * Trazabilidad: ARQUITECTURA.md §4.2, DEC-009, H02.1
 */

import type { SqliteDriver, DatabaseConfig } from './types.js';

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  name: 'tienda_libreria.db',
  journalMode: 'WAL',
  synchronous: 'FULL',
  foreignKeys: true,
};

/**
 * Inicializa y configura los pragmas de durabilidad e integridad de SQLite.
 * En SQLite, PRAGMA foreign_keys NO persiste entre conexiones y debe ejecutarse
 * obligatoriamente cada vez que se abre la base de datos.
 */
export const initializeDatabasePragmas = async (
  db: SqliteDriver,
  config: DatabaseConfig = DEFAULT_DATABASE_CONFIG,
): Promise<void> => {
  // 1. Integridad referencial mandatoria por conexión
  if (config.foreignKeys ?? true) {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  // 2. Modo Write-Ahead Logging para concurrencia de lectura sin bloqueo
  const journalMode = config.journalMode ?? 'WAL';
  await db.execAsync(`PRAGMA journal_mode = ${journalMode};`);

  // 3. Durabilidad financiera: FULL para fsync físico en transacciones
  const synchronous = config.synchronous ?? 'FULL';
  await db.execAsync(`PRAGMA synchronous = ${synchronous};`);
};
