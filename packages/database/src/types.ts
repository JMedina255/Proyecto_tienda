/**
 * @tienda/database - types.ts
 * Contratos de abstracción y tipos del motor SQLite para aplicaciones offline-first.
 * Trazabilidad: ARQUITECTURA.md §4.2, MODELO_DATOS.md §1.7, ESTANDAR_PROGRAMACION.md §4.1
 */

export interface RunResult {
  readonly lastInsertRowId: number;
  readonly changes: number;
}

export interface SqliteDriver {
  /**
   * Ejecuta sentencias DDL o scripts SQL compuestos (múltiples comandos separados por punto y coma).
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

  /**
   * Ejecuta una transacción diferida estándar (savepoints / BEGIN DEFERRED).
   */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;

  /**
   * Ejecuta una transacción exclusiva estricta (BEGIN IMMEDIATE / EXCLUSIVE).
   * Adquiere bloqueo reservado de escritura inmediatamente para evitar SQLITE_BUSY
   * o condiciones de carrera en operaciones financieras críticas.
   */
  withExclusiveTransactionAsync(task: () => Promise<void>): Promise<void>;

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
