import { describe, it, expect, vi } from 'vitest';
import { ExpoSqliteDriver } from '../src/expo-driver.js';
import type { ExpoSqliteDatabaseLike } from '../src/types.js';

describe('Adaptador ExpoSqliteDriver (expo-driver.ts)', () => {
  const mockDb: ExpoSqliteDatabaseLike = {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getFirstAsync: vi.fn().mockResolvedValue({ id: 'test-1' }),
    getAllAsync: vi.fn().mockResolvedValue([{ id: 'test-1' }, { id: 'test-2' }]),
    withTransactionAsync: vi.fn().mockImplementation(async (cb) => {
      await cb();
    }),
    withExclusiveTransactionAsync: vi.fn().mockImplementation(async (cb) => {
      await cb();
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

  it('delega withTransactionAsync y withExclusiveTransactionAsync', async () => {
    let calledRegular = false;
    await driver.withTransactionAsync(async () => {
      calledRegular = true;
    });
    expect(calledRegular).toBe(true);

    let calledExclusive = false;
    await driver.withExclusiveTransactionAsync(async () => {
      calledExclusive = true;
    });
    expect(calledExclusive).toBe(true);
  });

  it('delega closeAsync', async () => {
    await driver.closeAsync();
    expect(mockDb.closeAsync).toHaveBeenCalled();
  });
});
