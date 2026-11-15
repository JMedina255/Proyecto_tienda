import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BetterSqliteDriver } from '../src/test-driver.js';
import { MigrationRunner } from '../src/migrations.js';
import { OutboxRepository } from '../src/outbox-repository.js';
import type { SyncMutation } from '@tienda/shared-types';

describe('Repositorio Outbox (outbox-repository.ts)', () => {
  let db: BetterSqliteDriver;
  let repo: OutboxRepository;

  beforeEach(async () => {
    db = new BetterSqliteDriver(':memory:');
    const runner = new MigrationRunner(db);
    await runner.runMigrations();
    repo = new OutboxRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  const sampleMutation: SyncMutation = {
    id: '11111111-1111-4111-8111-111111111111',
    entityType: 'ventas',
    entityId: '22222222-2222-4222-8222-222222222222',
    operation: 'INSERT',
    payload: { totalNetoCentavos: 2500, serie: 'NV01', correlativo: 1 },
    idempotencyKey: 'a'.repeat(64),
    status: 'pending',
    retryCount: 0,
    lastError: null,
    createdAt: '2026-11-15T18:00:00.000Z',
  };

  it('encola una mutación y la recupera como pendiente', async () => {
    await repo.enqueue(sampleMutation);

    const pending = await repo.getPending(10);
    expect(pending.length).toBe(1);
    expect(pending[0]?.id).toBe(sampleMutation.id);
    expect(pending[0]?.entityType).toBe('ventas');
    expect(pending[0]?.idempotencyKey).toBe(sampleMutation.idempotencyKey);
    expect(pending[0]?.status).toBe('pending');
  });

  it('impide la duplicación de claves de idempotencia violando la restricción UNIQUE', async () => {
    await repo.enqueue(sampleMutation);

    const duplicateMutation: SyncMutation = {
      ...sampleMutation,
      id: '33333333-3333-4333-8333-333333333333', // diferente ID pero misma clave de idempotencia
    };

    await expect(repo.enqueue(duplicateMutation)).rejects.toThrow();
  });

  it('transiciona el ciclo de vida de una mutación: pending -> in_progress -> synced', async () => {
    await repo.enqueue(sampleMutation);

    await repo.markInProgress([sampleMutation.id]);
    let pending = await repo.getPending(10);
    expect(pending.length).toBe(0); // Ya no está en pending

    await repo.markSynced([sampleMutation.id]);
    const row = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM sync_outbox WHERE id = ?;',
      sampleMutation.id,
    );
    expect(row?.status).toBe('synced');
  });

  it('incrementa el contador de reintentos y actualiza el error en markFailed', async () => {
    await repo.enqueue(sampleMutation);

    await repo.markFailed(sampleMutation.id, 'Timeout de conexión');

    const pending = await repo.getPending(10);
    expect(pending.length).toBe(1);
    expect(pending[0]?.retryCount).toBe(1);
    expect(pending[0]?.lastError).toBe('Timeout de conexión');
  });

  it('comprueba correctamente hasIdempotencyKey y countPending', async () => {
    expect(await repo.hasIdempotencyKey(sampleMutation.idempotencyKey)).toBe(false);
    expect(await repo.countPending()).toBe(0);

    await repo.enqueue(sampleMutation);

    expect(await repo.hasIdempotencyKey(sampleMutation.idempotencyKey)).toBe(true);
    expect(await repo.countPending()).toBe(1);
  });

  it('recupera mutaciones huérfanas en in_progress regresándolas a pending tras reinicio inesperado', async () => {
    await repo.enqueue(sampleMutation);
    await repo.markInProgress([sampleMutation.id]);

    expect(await repo.countPending()).toBe(0);

    const recovered = await repo.resetInProgressToPending();
    expect(recovered).toBe(1);
    expect(await repo.countPending()).toBe(1);

    const pending = await repo.getPending(10);
    expect(pending[0]?.id).toBe(sampleMutation.id);
    expect(pending[0]?.status).toBe('pending');
  });
});
