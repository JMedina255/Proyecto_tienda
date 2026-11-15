import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationRunner, OutboxRepository } from '@tienda/database';
import { BetterSqliteDriver } from '@tienda/database/test';
import { SimulatedSupabaseRpcClient } from '../src/rpc-client.js';
import { SyncDispatcher } from '../src/dispatcher.js';
import { generateIdempotencyKey } from '../src/idempotency.js';
import type { SyncMutation } from '@tienda/shared-types';

describe('Despachador de Sincronización Outbox (SyncDispatcher)', () => {
  let db: BetterSqliteDriver;
  let outboxRepo: OutboxRepository;
  let rpcClient: SimulatedSupabaseRpcClient;
  let dispatcher: SyncDispatcher;

  const config = {
    dispositivoId: 'test-device-uuid-1',
    usuarioId: 'test-user-uuid-1',
    appVersion: '0.1.0',
    batchSize: 10,
  };

  beforeEach(async () => {
    db = new BetterSqliteDriver(':memory:');
    const runner = new MigrationRunner(db);
    await runner.runMigrations();
    outboxRepo = new OutboxRepository(db);
    rpcClient = new SimulatedSupabaseRpcClient();
    dispatcher = new SyncDispatcher(outboxRepo, rpcClient, config);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  const createSampleMutation = (id: string, entityId: string): SyncMutation => {
    const timestamp = new Date().toISOString();
    const payload = { test: true, entityId };
    const idempotencyKey = generateIdempotencyKey({
      dispositivoId: config.dispositivoId,
      entityType: 'ventas',
      entityId,
      operation: 'INSERT',
      timestamp,
      payload,
    });

    return {
      id,
      entityType: 'ventas',
      entityId,
      operation: 'INSERT',
      payload,
      idempotencyKey,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      createdAt: timestamp,
    };
  };

  it('procesa y sincroniza exitosamente mutaciones en modo online', async () => {
    const mut1 = createSampleMutation('mut-1', 'ent-1');
    const mut2 = createSampleMutation('mut-2', 'ent-2');

    await outboxRepo.enqueue(mut1);
    await outboxRepo.enqueue(mut2);

    expect(await outboxRepo.countPending()).toBe(2);

    const result = await dispatcher.dispatchPending();
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);

    // En la base local ya no quedan mutaciones pending
    expect(await outboxRepo.countPending()).toBe(0);

    // En el cliente remoto se registraron ambas claves
    expect(rpcClient.getProcessedKeysCount()).toBe(2);
    expect(rpcClient.isKeyProcessed(mut1.idempotencyKey)).toBe(true);
    expect(rpcClient.isKeyProcessed(mut2.idempotencyKey)).toBe(true);
  });

  it('soporta fallas de conexión (modo offline) sin pérdida de datos e incrementa reintentos', async () => {
    const mut = createSampleMutation('mut-offline', 'ent-offline');
    await outboxRepo.enqueue(mut);

    // Simulamos que el dispositivo no tiene internet
    rpcClient.setNetworkMode('offline');

    const result = await dispatcher.dispatchPending();
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);

    // La mutación NO se borró: sigue en la base SQLite con estado pending e incremento de reintentos
    const pending = await outboxRepo.getPending();
    expect(pending.length).toBe(1);
    expect(pending[0]?.id).toBe('mut-offline');
    expect(pending[0]?.retryCount).toBe(1);
    expect(pending[0]?.lastError).toContain('modo offline');

    // Al restablecer la red ('online'), la sincronización se recupera exitosamente
    rpcClient.setNetworkMode('online');
    const retryResult = await dispatcher.dispatchPending();
    expect(retryResult.processed).toBe(1);
    expect(retryResult.failed).toBe(0);

    expect(await outboxRepo.countPending()).toBe(0);
    expect(rpcClient.isKeyProcessed(mut.idempotencyKey)).toBe(true);
  });

  it('procesa de forma idempotente mutaciones previamente enviadas sin duplicar', async () => {
    const mut = createSampleMutation('mut-idemp', 'ent-idemp');
    await outboxRepo.enqueue(mut);

    // Primer despacho
    const firstDispatch = await dispatcher.dispatchPending();
    expect(firstDispatch.processed).toBe(1);

    // Si la mutación se re-encolara con la misma clave de idempotencia en un mock remoto
    const pushAgain = await rpcClient.pushMutations({
      dispositivoId: config.dispositivoId,
      usuarioId: config.usuarioId,
      appVersion: config.appVersion,
      mutations: [mut],
    });

    expect(pushAgain.processedCount).toBe(1);
    expect(pushAgain.results[0]?.success).toBe(true);
  });
});
