import { describe, it, expect, vi } from 'vitest';
import { ExpoSqliteDriver } from '../src/expo-driver.js';
import type { ExpoSqliteDatabaseLike } from '../src/types.js';

describe('Adaptador ExpoSqliteDriver (expo-driver.ts)', () => {
  const fakeExpoTxn: ExpoSqliteDatabaseLike = {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue({ lastInsertRowId: 99, changes: 1 }),
    getFirstAsync: vi.fn().mockResolvedValue({ id: 'txn-row' }),
    getAllAsync: vi.fn().mockResolvedValue([{ id: 'txn-row' }]),
    withTransactionAsync: vi.fn(),
    withExclusiveTransactionAsync: vi.fn(),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  };

  const mockDb: ExpoSqliteDatabaseLike = {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getFirstAsync: vi.fn().mockResolvedValue({ id: 'test-1' }),
    getAllAsync: vi.fn().mockResolvedValue([{ id: 'test-1' }, { id: 'test-2' }]),
    withTransactionAsync: vi.fn().mockImplementation(async (cb) => {
      await cb();
    }),
    withExclusiveTransactionAsync: vi.fn().mockImplementation(async (cb) => {
      await cb(fakeExpoTxn);
    }),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  };

  const driver = new ExpoSqliteDriver(mockDb);

  it('delega execAsync correctamente', async () => {
    await driver.execAsync('PRAGMA foreign_keys = ON;');
    expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
  });

  it('delega runAsync y normaliza el resultado', async () => {
    const res = await driver.runAsync('INSERT INTO test VALUES (?)', 'val');
    expect(mockDb.runAsync).toHaveBeenCalledWith('INSERT INTO test VALUES (?)', 'val');
    expect(res).toEqual({ lastInsertRowId: 1, changes: 1 });
  });

  it('delega getFirstAsync y getAllAsync', async () => {
    const first = await driver.getFirstAsync('SELECT * FROM test LIMIT 1');
    expect(first).toEqual({ id: 'test-1' });

    const all = await driver.getAllAsync('SELECT * FROM test');
    expect(all).toHaveLength(2);
  });

  it('proporciona el objeto transaccional txn en withTransactionAsync y withExclusiveTransactionAsync', async () => {
    const valTxn = await driver.withTransactionAsync(async (txn) => {
      expect(txn).toBeDefined();
      const res = await txn.runAsync('INSERT INTO txn_test VALUES (?)', 1);
      expect(res.lastInsertRowId).toBe(1);
      return 'txn_done';
    });
    expect(valTxn).toBe('txn_done');
    expect(mockDb.runAsync).toHaveBeenCalledWith('INSERT INTO txn_test VALUES (?)', 1);

    const valExclusive = await driver.withExclusiveTransactionAsync(async (txn) => {
      expect(txn).toBeDefined();
      const row = await txn.getFirstAsync('SELECT 1');
      expect(row).toEqual({ id: 'test-1' });
      return 'exclusive_done';
    });
    expect(valExclusive).toBe('exclusive_done');
    expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN IMMEDIATE;');
    expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT;');
  });

  it('delega closeAsync', async () => {
    await driver.closeAsync();
    expect(mockDb.closeAsync).toHaveBeenCalled();
  });

  it('serializa escrituras externas impidiendo que se incorporen a una transacción activa', async () => {
    const events: string[] = [];

    // Iniciamos una transacción que tarda deliberadamente unos ms
    const txnPromise = driver.withExclusiveTransactionAsync(async (txn) => {
      events.push('txn_begin');
      await txn.runAsync('INSERT INTO inside_txn VALUES (1)');
      events.push('txn_write');
      await new Promise((resolve) => setTimeout(resolve, 30));
      events.push('txn_commit');
    });

    // Lanzamos inmediatamente una escritura externa concurrente vía driver.runAsync
    const externalPromise = driver.runAsync('INSERT INTO outside_txn VALUES (2)').then(() => {
      events.push('external_write_done');
    });

    await Promise.all([txnPromise, externalPromise]);

    // La escritura externa DEBE ejecutarse estrictamente DESPUÉS del commit de la transacción
    expect(events).toEqual([
      'txn_begin',
      'txn_write',
      'txn_commit',
      'external_write_done',
    ]);
  });
});
