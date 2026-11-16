import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BetterSqliteDriver } from '../src/test-driver.js';
import { initializeDatabasePragmas } from '../src/connection.js';
import { MigrationRunner } from '../src/migrations.js';
import { OutboxRepository } from '../src/outbox-repository.js';
import type { SyncMutation } from '@tienda/shared-types';

describe('Semántica Transaccional y Atomicidad Financiera (withExclusiveTransactionAsync)', () => {
  let db: BetterSqliteDriver;
  let outboxRepo: OutboxRepository;

  beforeEach(async () => {
    db = new BetterSqliteDriver(':memory:');
    await initializeDatabasePragmas(db);
    const runner = new MigrationRunner(db);
    await runner.runMigrations();
    outboxRepo = new OutboxRepository(db);

    // Creamos tablas simuladas de negocio con restricción de clave foránea
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS demo_ventas (
        id TEXT PRIMARY KEY NOT NULL,
        total_neto INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS demo_pagos (
        id TEXT PRIMARY KEY NOT NULL,
        venta_id TEXT NOT NULL,
        monto INTEGER NOT NULL,
        FOREIGN KEY (venta_id) REFERENCES demo_ventas(id) ON DELETE RESTRICT
      );
    `);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  const mutation: SyncMutation = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    entityType: 'ventas',
    entityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    operation: 'INSERT',
    payload: { totalNeto: 1500 },
    idempotencyKey: 'f'.repeat(64),
    status: 'pending',
    retryCount: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
  };

  it('confirma atómicamente la entidad local y la mutación outbox ejecutando mediante txn', async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT INTO demo_ventas (id, total_neto) VALUES (?, ?);', mutation.entityId, 1500);
      await outboxRepo.enqueue(mutation, txn);
    });

    // Verificamos persistencia de ambos
    const venta = await db.getFirstAsync<{ id: string }>('SELECT id FROM demo_ventas WHERE id = ?;', mutation.entityId);
    expect(venta?.id).toBe(mutation.entityId);

    const pending = await outboxRepo.getPending();
    expect(pending.length).toBe(1);
    expect(pending[0]?.id).toBe(mutation.id);
  });

  it('revierte íntegramente la transacción si ocurre un fallo a mitad de la operación', async () => {
    const taskFailed = db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT INTO demo_ventas (id, total_neto) VALUES (?, ?);', mutation.entityId, 1500);
      await outboxRepo.enqueue(mutation, txn);
      // Simulamos excepción imprevista (p. ej. fallo de validación o caída)
      throw new Error('Fallo crítico simulado durante el flujo transaccional');
    });

    await expect(taskFailed).rejects.toThrow('Fallo crítico simulado durante el flujo transaccional');

    // Ninguno de los dos registros debe persistir en la base de datos
    const venta = await db.getFirstAsync<{ id: string }>('SELECT id FROM demo_ventas WHERE id = ?;', mutation.entityId);
    expect(venta).toBeNull();

    const pending = await outboxRepo.getPending();
    expect(pending.length).toBe(0);
  });

  it('hace cumplir las restricciones de clave foránea dentro de la transacción y revierte escrituras previas', async () => {
    const invalidFkTask = db.withExclusiveTransactionAsync(async (txn) => {
      // 1. Insertamos venta válida
      await txn.runAsync('INSERT INTO demo_ventas (id, total_neto) VALUES (?, ?);', 'venta-valida-1', 2000);
      // 2. Intentamos insertar un pago para una venta inexistente (viola FK)
      await txn.runAsync(
        'INSERT INTO demo_pagos (id, venta_id, monto) VALUES (?, ?, ?);',
        'pago-invalido-1',
        'venta-inexistente-uuid',
        1000,
      );
    });

    await expect(invalidFkTask).rejects.toThrow(/FOREIGN KEY/i);

    // Como falló la FK, la venta 'venta-valida-1' también debe haber sido revertida
    const venta = await db.getFirstAsync<{ id: string }>('SELECT id FROM demo_ventas WHERE id = ?;', 'venta-valida-1');
    expect(venta).toBeNull();
  });

  it('revierte la transacción completa si se intenta duplicar una clave de idempotencia', async () => {
    // 1. Primera inserción exitosa
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT INTO demo_ventas (id, total_neto) VALUES (?, ?);', mutation.entityId, 1500);
      await outboxRepo.enqueue(mutation, txn);
    });

    // 2. Segundo intento con mismo idempotencyKey pero diferente venta
    const duplicateTask = db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT INTO demo_ventas (id, total_neto) VALUES (?, ?);', 'venta-segunda-duplicada', 3000);
      // Falla por UNIQUE(idempotency_key)
      await outboxRepo.enqueue({ ...mutation, id: 'nueva-mutacion-id', entityId: 'venta-segunda-duplicada' }, txn);
    });

    await expect(duplicateTask).rejects.toThrow(/UNIQUE/i);

    // La segunda venta 'venta-segunda-duplicada' no debe existir
    const venta2 = await db.getFirstAsync('SELECT id FROM demo_ventas WHERE id = ?;', 'venta-segunda-duplicada');
    expect(venta2).toBeNull();

    // Solo debe quedar 1 mutación en outbox
    const count = await outboxRepo.countPending();
    expect(count).toBe(1);
  });
});
