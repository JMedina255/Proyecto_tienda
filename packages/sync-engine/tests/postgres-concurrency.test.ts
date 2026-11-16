import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('PostgreSQL Real Multi-Connection Concurrency & Atomicity Test (Port 5433)', () => {
  const PG_CONFIG = {
    host: '127.0.0.1',
    port: 5433,
    user: 'postgres',
    database: 'postgres',
  };

  const USER_A_ID = '11111111-1111-4111-8111-111111111111';
  let adminClient: Client;
  let isPgAvailable = false;

  beforeAll(async () => {
    adminClient = new Client(PG_CONFIG);
    try {
      await adminClient.connect();
      isPgAvailable = true;

      // Configurar infraestructura GoTrue y roles
      await adminClient.query(`
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id UUID PRIMARY KEY,
          email TEXT,
          created_at TIMESTAMPTZ DEFAULT clock_timestamp()
        );

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
          SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID;
        $$ LANGUAGE sql STABLE;

        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB AS $$
          SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::JSONB;
        $$ LANGUAGE sql STABLE;

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon;
          END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role;
          END IF;
        END
        $$;

        INSERT INTO auth.users (id, email) VALUES
          ('${USER_A_ID}', 'vendedorA@libreria.com')
        ON CONFLICT (id) DO NOTHING;
      `);

      // Ejecutar la migración oficial
      const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20261115000001_sync_infrastructure.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      await adminClient.query(migrationSql);
      await adminClient.query(`TRUNCATE TABLE public.sync_processed_mutations, public.sync_test_records;`);
    } catch (err) {
      console.warn('PostgreSQL local 5433 no disponible para prueba de concurrencia:', (err as Error).message);
      isPgAvailable = false;
    }
  });

  afterAll(async () => {
    if (adminClient) {
      try {
        await adminClient.end();
      } catch {
        // ignore
      }
    }
  });

  beforeEach(async () => {
    if (isPgAvailable && adminClient) {
      await adminClient.query(`TRUNCATE TABLE public.sync_processed_mutations, public.sync_test_records;`);
    }
  });

  it('Dos conexiones independientes concurrentes sobre la misma clave: una sola aplicación física y resultado consistente', async () => {
    if (!isPgAvailable) {
      console.warn('Saltando prueba de concurrencia real: servidor PostgreSQL no accesible.');
      return;
    }

    const client1 = new Client(PG_CONFIG);
    const client2 = new Client(PG_CONFIG);

    await client1.connect();
    await client2.connect();

    try {
      const claims = JSON.stringify({
        sub: USER_A_ID,
        role: 'authenticated',
        app_metadata: { role: 'vendedor' },
      });

      // Configurar sesión autenticada en ambas conexiones independientes
      await client1.query(`
        SELECT set_config('request.jwt.claim.sub', '${USER_A_ID}', false);
        SELECT set_config('request.jwt.claims', '${claims}', false);
        SET ROLE authenticated;
      `);

      await client2.query(`
        SELECT set_config('request.jwt.claim.sub', '${USER_A_ID}', false);
        SELECT set_config('request.jwt.claims', '${claims}', false);
        SET ROLE authenticated;
      `);

      const key = 'e'.repeat(64);
      const entityId = 'concurrent-rec-001';
      const batch = {
        dispositivoId: 'disp-concurrency',
        appVersion: '0.1.0',
        mutations: [
          {
            idempotencyKey: key,
            entityType: 'sync_test',
            entityId,
            operation: 'INSERT',
            payload: { title: 'Venta Concurrente', amount: 5000 },
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const batchJson = JSON.stringify(batch);

      // Disparar ambas peticiones en paralelo exacto a través de los dos sockets TCP independientes
      const [res1, res2] = await Promise.all([
        client1.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [batchJson]),
        client2.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [batchJson]),
      ]);

      const data1 = res1.rows[0].sync_push_mutations;
      const data2 = res2.rows[0].sync_push_mutations;

      expect(data1.success).toBe(true);
      expect(data2.success).toBe(true);

      const status1 = data1.results[0].status;
      const status2 = data2.results[0].status;

      // Exactamente una debió procesar y la otra responder already_applied
      const statuses = [status1, status2].sort();
      expect(statuses).toEqual(['already_applied', 'processed']);

      // Comprobar consistencia física en la base de datos real
      const checkRecord = await adminClient.query(
        `SELECT COUNT(*)::int as count FROM public.sync_test_records WHERE id = $1;`,
        [entityId],
      );
      expect(checkRecord.rows[0].count).toBe(1);

      const checkAudit = await adminClient.query(
        `SELECT COUNT(*)::int as count, status FROM public.sync_processed_mutations WHERE idempotency_key = $1 GROUP BY status;`,
        [key],
      );
      expect(checkAudit.rows.length).toBe(1);
      expect(checkAudit.rows[0].count).toBe(1);
      expect(checkAudit.rows[0].status).toBe('processed');
    } finally {
      await client1.end();
      await client2.end();
    }
  });

  it('Dos conexiones concurrentes con misma clave pero distinto payload: una procesa y la otra se rechaza', async () => {
    if (!isPgAvailable) return;

    const client1 = new Client(PG_CONFIG);
    const client2 = new Client(PG_CONFIG);

    await client1.connect();
    await client2.connect();

    try {
      const claims = JSON.stringify({
        sub: USER_A_ID,
        role: 'authenticated',
        app_metadata: { role: 'vendedor' },
      });

      await client1.query(`
        SELECT set_config('request.jwt.claim.sub', '${USER_A_ID}', false);
        SELECT set_config('request.jwt.claims', '${claims}', false);
        SET ROLE authenticated;
      `);

      await client2.query(`
        SELECT set_config('request.jwt.claim.sub', '${USER_A_ID}', false);
        SELECT set_config('request.jwt.claims', '${claims}', false);
        SET ROLE authenticated;
      `);

      const key = 'f'.repeat(64);
      const entityId = 'concurrent-payload-002';

      const batch1 = {
        dispositivoId: 'disp-concurrency-1',
        appVersion: '0.1.0',
        mutations: [
          {
            idempotencyKey: key,
            entityType: 'sync_test',
            entityId,
            operation: 'INSERT',
            payload: { amount: 1000 },
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const batch2 = {
        dispositivoId: 'disp-concurrency-2',
        appVersion: '0.1.0',
        mutations: [
          {
            idempotencyKey: key,
            entityType: 'sync_test',
            entityId,
            operation: 'INSERT',
            payload: { amount: 2000 }, // Distinto contenido
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const [res1, res2] = await Promise.all([
        client1.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [JSON.stringify(batch1)]),
        client2.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [JSON.stringify(batch2)]),
      ]);

      const data1 = res1.rows[0].sync_push_mutations;
      const data2 = res2.rows[0].sync_push_mutations;

      const statuses = [data1.results[0].status, data2.results[0].status].sort();
      expect(statuses).toEqual(['processed', 'rejected']);

      // El que falló debió reportar success: false y error descriptivo
      const rejectedResult = data1.results[0].status === 'rejected' ? data1.results[0] : data2.results[0];
      expect(rejectedResult.success).toBe(false);
      expect(rejectedResult.error).toMatch(/Clave de idempotencia reutilizada con parámetros o contenido diferentes/);
    } finally {
      await client1.end();
      await client2.end();
    }
  });
});
