/**
 * @tienda/database - types.ts
 * Contratos de abstracción y tipos del motor SQLite para aplicaciones offline-first.
 * Trazabilidad: ARQUITECTURA.md §4.2, MODELO_DATOS.md §1.7, ESTANDAR_PROGRAMACION.md §4.1
 */

export interface RunResult {
  readonly lastInsertRowId: number;
  readonly changes: number;
}

/**
 * Operaciones DML/DQL ejecutables dentro de una conexión o contexto transaccional.
 */
export interface SqliteTransactionDriver {
  /**
   * Ejecuta sentencias DDL o scripts SQL compuestos.
   */
  execAsync(sql: string): Promise<void>;

  /**
   * Ejecuta una sentencia SQL parametrizada DML (INSERT, UPDATE, DELETE).
   */
  runAsync(sql: string, ...params: unknown[]): Promise<RunResult>;

  /**
   * Ejecuta una consulta SELECT y retorna la primera fila o null.
   */
  getFirstAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T | null>;

  /**
   * Ejecuta una consulta SELECT y retorna todas las filas encontradas.
   */
  getAllAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
}

/**
 * Contrato principal del motor SQLite, incluyendo control transaccional estricto y cierre de conexión.
 */
export interface SqliteDriver extends SqliteTransactionDriver {
  /**
   * Ejecuta una transacción diferida estándar (BEGIN DEFERRED).
   * Pasa un objeto `txn` que debe utilizarse para ejecutar todas las operaciones internas.
   */
  withTransactionAsync<T = void>(task: (txn: SqliteTransactionDriver) => Promise<T>): Promise<T>;

  /**
   * Ejecuta una transacción exclusiva estricta (BEGIN IMMEDIATE / EXCLUSIVE).
   * Adquiere bloqueo reservado de escritura inmediatamente para evitar SQLITE_BUSY.
   * Pasa un objeto `txn` que debe utilizarse para todas las operaciones internas,
   * evitando que se ejecuten escrituras fuera de la transacción.
   */
  withExclusiveTransactionAsync<T = void>(task: (txn: SqliteTransactionDriver) => Promise<T>): Promise<T>;

  /**
   * Cierra la conexión física a la base de datos.
   */
  closeAsync(): Promise<void>;
}

export interface DatabaseConfig {
  readonly name: string;
  readonly journalMode?: 'WAL' | 'DELETE';
  readonly synchronous?: 'FULL' | 'NORMAL';
  readonly foreignKeys?: boolean;
}

/**
 * Firma estructural compatible con SQLiteDatabase de 'expo-sqlite' (SDK 52+).
 */
export interface ExpoSqliteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>;
  withTransactionAsync?(task: () => Promise<void>): Promise<void>;
  withExclusiveTransactionAsync?(task: (txn: any) => Promise<void>): Promise<void>;
  closeAsync?(): Promise<void>;
}
