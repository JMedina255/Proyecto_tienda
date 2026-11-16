import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('PostgreSQL Real Migration & Security Audit (PGlite)', () => {
  let db: PGlite;

  const USER_A_ID = '11111111-1111-4111-8111-111111111111';
  const USER_B_ID = '22222222-2222-4222-8222-222222222222';
  const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

  beforeEach(async () => {
    db = new PGlite();

    // 1. Configurar infraestructura previa de Supabase GoTrue Auth
    await db.exec(`
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

      -- Roles estándar de Supabase
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
        ('${USER_A_ID}', 'vendedorA@libreria.com'),
        ('${USER_B_ID}', 'vendedorB@libreria.com'),
        ('${ADMIN_ID}', 'admin@libreria.com')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Ejecutar la migración real versionada
    const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20261115000001_sync_infrastructure.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(migrationSql);
  });

  const setAuthContext = async (userId: string | null, role: 'vendedor' | 'dueno' | 'administrador' | null) => {
    await db.exec(`RESET ROLE;`);
    if (userId) {
      const claims = JSON.stringify({
        sub: userId,
        role: 'authenticated',
        app_metadata: { role: role ?? 'vendedor' },
      });
      await db.exec(`
        SELECT set_config('request.jwt.claim.sub', '${userId}', false);
        SELECT set_config('request.jwt.claims', '${claims}', false);
        SET ROLE authenticated;
      `);
    } else {
      await db.exec(`
        SELECT set_config('request.jwt.claim.sub', '', false);
        SELECT set_config('request.jwt.claims', '', false);
        SET ROLE anon;
      `);
    }
  };

  it('1. Rechaza la ejecución de sync_push_mutations si no hay sesión autenticada (SQLSTATE 28000 o denegación de privilegios)', async () => {
    await setAuthContext(null, null);

    const batch = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [],
    };

    await expect(
      db.query(`SELECT public.sync_push_mutations($1::jsonb);`, [JSON.stringify(batch)]),
    ).rejects.toThrow(/(permission denied for function sync_push_mutations|No autenticado)/);
  });

  it('2. Valida los límites de lote: rechaza lotes vacíos o superiores a 100 mutaciones', async () => {
    await setAuthContext(USER_A_ID, 'vendedor');

    // Lote vacío
    await expect(
      db.query(`SELECT public.sync_push_mutations($1::jsonb);`, [JSON.stringify({ mutations: [] })]),
    ).rejects.toThrow(/El lote no contiene mutaciones/);

    // Lote > 100
    const oversized = Array.from({ length: 101 }, (_, i) => ({
      idempotencyKey: 'a'.repeat(64),
      entityType: 'sync_test',
      entityId: `id-${i}`,
      operation: 'INSERT',
      payload: { test: true },
      createdAt: new Date().toISOString(),
    }));

    await expect(
      db.query(`SELECT public.sync_push_mutations($1::jsonb);`, [JSON.stringify({ mutations: oversized })]),
    ).rejects.toThrow(/El lote excede el límite máximo permitido de 100/);
  });

  it('3. Aplica INSERT válido en tabla real de dominio y registra auditoría en sync_processed_mutations', async () => {
    await setAuthContext(USER_A_ID, 'vendedor');

    const key = '1'.repeat(64);
    const entityId = 'rec-001';
    const batch = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [
        {
          idempotencyKey: key,
          entityType: 'sync_test',
          entityId,
          operation: 'INSERT',
          payload: { title: 'Libro de Prueba', precio: 2500 },
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const res = await db.query<{ sync_push_mutations: any }>(
      `SELECT public.sync_push_mutations($1::jsonb);`,
      [JSON.stringify(batch)],
    );

    const data = res.rows[0].sync_push_mutations;
    expect(data.success).toBe(true);
    expect(data.processedCount).toBe(1);
    expect(data.results[0].status).toBe('processed');
    expect(data.results[0].success).toBe(true);

    // Verificar persistencia física real en sync_test_records
    const recordRes = await db.query<{ id: string; created_by: string; payload: any }>(
      `SELECT id, created_by, payload FROM public.sync_test_records WHERE id = $1;`,
      [entityId],
    );
    expect(recordRes.rows.length).toBe(1);
    expect(recordRes.rows[0].created_by).toBe(USER_A_ID);
    expect(recordRes.rows[0].payload.title).toBe('Libro de Prueba');

    // Verificar registro en sync_processed_mutations
    const auditRes = await db.query<{ idempotency_key: string; usuario_id: string; operation: string }>(
      `SELECT idempotency_key, usuario_id, operation FROM public.sync_processed_mutations WHERE idempotency_key = $1;`,
      [key],
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].usuario_id).toBe(USER_A_ID);
    expect(auditRes.rows[0].operation).toBe('INSERT');
  });

  it('4. RLS en sync_test_records: un usuario normal no puede leer registros creados por otro usuario', async () => {
    // Usuario A crea el registro a través de la función segura
    await setAuthContext(USER_A_ID, 'vendedor');
    await db.query(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: 'f'.repeat(64),
            entityType: 'sync_test',
            entityId: 'secret-rec',
            operation: 'INSERT',
            payload: { secreto: true },
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);

    // Usuario B intenta leerlo directamente con RLS activo
    await setAuthContext(USER_B_ID, 'vendedor');
    const bRes = await db.query(
      `SELECT * FROM public.sync_test_records WHERE id = 'secret-rec';`,
    );
    expect(bRes.rows.length).toBe(0);

    // Usuario Administrador sí puede leerlo
    await setAuthContext(ADMIN_ID, 'administrador');
    const adminRes = await db.query(
      `SELECT * FROM public.sync_test_records WHERE id = 'secret-rec';`,
    );
    expect(adminRes.rows.length).toBe(1);
  });

  it('5. Previene la suplantación de usuario: ignora usuarioId enviado en el payload y usa auth.uid()', async () => {
    await setAuthContext(USER_A_ID, 'vendedor');

    const key = '2'.repeat(64);
    const batch = {
      dispositivoId: 'disp-01',
      usuarioId: USER_B_ID, // Intento malicioso de suplantar a usuario B
      mutations: [
        {
          idempotencyKey: key,
          entityType: 'sync_test',
          entityId: 'spoof-test',
          operation: 'INSERT',
          payload: { data: 'test' },
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const res = await db.query<{ sync_push_mutations: any }>(
      `SELECT public.sync_push_mutations($1::jsonb);`,
      [JSON.stringify(batch)],
    );

    expect(res.rows[0].sync_push_mutations.success).toBe(true);

    // Comprobar que en la base de datos se registró USER_A_ID, no USER_B_ID
    const auditRes = await db.query<{ usuario_id: string }>(
      `SELECT usuario_id FROM public.sync_processed_mutations WHERE idempotency_key = $1;`,
      [key],
    );
    expect(auditRes.rows[0].usuario_id).toBe(USER_A_ID);
  });

  it('6. Rechaza actualización no autorizada sobre un registro ajeno', async () => {
    // Usuario A crea el registro
    await setAuthContext(USER_A_ID, 'vendedor');
    const insertKey = '3'.repeat(64);
    await db.query(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: insertKey,
            entityType: 'sync_test',
            entityId: 'target-rec',
            operation: 'INSERT',
            payload: { version: 1 },
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);

    // Usuario B intenta hacer UPDATE
    await setAuthContext(USER_B_ID, 'vendedor');
    const updateKey = '4'.repeat(64);
    const res = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: updateKey,
            entityType: 'sync_test',
            entityId: 'target-rec',
            operation: 'UPDATE',
            payload: { version: 2 },
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);

    const result = res.rows[0].sync_push_mutations.results[0];
    expect(result.status).toBe('rejected');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permiso denegado: no es propietario/);

    // Verificar como Usuario A (creador) que el registro original permanece intacto
    await setAuthContext(USER_A_ID, 'vendedor');
    const checkRes = await db.query<{ payload: any }>(
      `SELECT payload FROM public.sync_test_records WHERE id = 'target-rec';`,
    );
    expect(checkRes.rows[0].payload.version).toBe(1);
  });

  it('7. RBAC y propiedad en DELETE: rol vendedor no puede borrar; usuario ajeno tampoco', async () => {
    // Usuario A crea registro
    await setAuthContext(USER_A_ID, 'vendedor');
    await db.query(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: '5'.repeat(64),
            entityType: 'sync_test',
            entityId: 'del-rec',
            operation: 'INSERT',
            payload: { active: true },
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);

    // Usuario A (vendedor) intenta DELETE -> rechazado por RBAC
    const delVendedorRes = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: '6'.repeat(64),
            entityType: 'sync_test',
            entityId: 'del-rec',
            operation: 'DELETE',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);
    expect(delVendedorRes.rows[0].sync_push_mutations.results[0].status).toBe('rejected');
    expect(delVendedorRes.rows[0].sync_push_mutations.results[0].error).toMatch(/rol vendedor no tiene privilegios/);

    // Usuario B (administrador pero no creador) sí puede o dueño puede borrar
    await setAuthContext(ADMIN_ID, 'administrador');
    const delAdminRes = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: '7'.repeat(64),
            entityType: 'sync_test',
            entityId: 'del-rec',
            operation: 'DELETE',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);
    expect(delAdminRes.rows[0].sync_push_mutations.results[0].status).toBe('processed');
    expect(delAdminRes.rows[0].sync_push_mutations.results[0].success).toBe(true);

    // Registro eliminado
    const checkRes = await db.query(`SELECT * FROM public.sync_test_records WHERE id = 'del-rec';`);
    expect(checkRes.rows.length).toBe(0);
  });

  it('8. Rechaza UPDATE o DELETE sobre registros inexistentes informando 0 filas afectadas', async () => {
    await setAuthContext(ADMIN_ID, 'administrador');

    const res = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: '8'.repeat(64),
            entityType: 'sync_test',
            entityId: 'no-existe',
            operation: 'UPDATE',
            payload: { foo: 'bar' },
            createdAt: new Date().toISOString(),
          },
          {
            idempotencyKey: '9'.repeat(64),
            entityType: 'sync_test',
            entityId: 'no-existe-2',
            operation: 'DELETE',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);

    const results = res.rows[0].sync_push_mutations.results;
    expect(results[0].status).toBe('rejected');
    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/Registro no encontrado para actualización/);

    expect(results[1].status).toBe('rejected');
    expect(results[1].success).toBe(false);
    expect(results[1].error).toMatch(/Registro no encontrado para eliminación/);
  });

  it('9. Idempotencia reforzada: reintento idéntico retorna already_applied; parámetros alterados se rechazan', async () => {
    await setAuthContext(USER_A_ID, 'vendedor');

    const key = 'a'.repeat(64);
    const mutation = {
      idempotencyKey: key,
      entityType: 'sync_test',
      entityId: 'idem-rec',
      operation: 'INSERT',
      payload: { value: 100 },
      createdAt: new Date().toISOString(),
    };

    // 1er intento: procesado
    const res1 = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({ mutations: [mutation] }),
    ]);
    expect(res1.rows[0].sync_push_mutations.results[0].status).toBe('processed');

    // 2do intento idéntico: already_applied con success: true
    const res2 = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({ mutations: [mutation] }),
    ]);
    expect(res2.rows[0].sync_push_mutations.results[0].status).toBe('already_applied');
    expect(res2.rows[0].sync_push_mutations.results[0].success).toBe(true);

    // 3er intento: MISMA clave pero DISTINTO payload (debe rechazarse)
    const alteredPayloadMutation = {
      ...mutation,
      payload: { value: 999 },
    };
    const resPayload = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({ mutations: [alteredPayloadMutation] }),
    ]);
    expect(resPayload.rows[0].sync_push_mutations.results[0].status).toBe('rejected');
    expect(resPayload.rows[0].sync_push_mutations.results[0].success).toBe(false);
    expect(resPayload.rows[0].sync_push_mutations.results[0].error).toMatch(/Clave de idempotencia reutilizada con parámetros o contenido diferentes/);

    // 4to intento: MISMA clave pero OTRO entityId (intento de reutilización/colisión)
    const alteredMutation = {
      ...mutation,
      entityId: 'otro-rec-distinto',
    };
    const res3 = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({ mutations: [alteredMutation] }),
    ]);
    expect(res3.rows[0].sync_push_mutations.results[0].status).toBe('rejected');
    expect(res3.rows[0].sync_push_mutations.results[0].success).toBe(false);
    expect(res3.rows[0].sync_push_mutations.results[0].error).toMatch(/Clave de idempotencia reutilizada con parámetros o contenido diferentes/);

    // 5to intento: MISMA clave pero OTRO usuario
    await setAuthContext(USER_B_ID, 'vendedor');
    const res4 = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({ mutations: [mutation] }),
    ]);
    expect(res4.rows[0].sync_push_mutations.results[0].status).toBe('rejected');
    expect(res4.rows[0].sync_push_mutations.results[0].success).toBe(false);
    expect(res4.rows[0].sync_push_mutations.results[0].error).toMatch(/Clave de idempotencia reutilizada con parámetros o contenido diferentes/);
  });

  it('10. Rechaza mutaciones financieras aún no implementadas (hoja de ruta H07+)', async () => {
    await setAuthContext(USER_A_ID, 'vendedor');

    const res = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: 'b'.repeat(64),
            entityType: 'ventas',
            entityId: 'vta-001',
            operation: 'INSERT',
            payload: { total: 5000 },
            createdAt: new Date().toISOString(),
          },
          {
            idempotencyKey: 'c'.repeat(64),
            entityType: 'movimientos_caja',
            entityId: 'caja-001',
            operation: 'INSERT',
            payload: { monto: 1000 },
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);

    const results = res.rows[0].sync_push_mutations.results;
    expect(results[0].status).toBe('rejected');
    expect(results[0].error).toMatch(/Entidad aún no implementada en el backend \(prevista para H07\+\): ventas/);
    expect(results[1].status).toBe('rejected');
    expect(results[1].error).toMatch(/Entidad aún no implementada en el backend \(prevista para H07\+\): movimientos_caja/);
  });

  it('11. Fallo después de reservar idempotencia: rollback completo (la clave no queda registrada como procesada)', async () => {
    await setAuthContext(USER_A_ID, 'vendedor');

    const failKey = 'd'.repeat(64);
    // Intento de UPDATE sobre un registro inexistente -> falla con 0 filas afectadas
    const res = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
      JSON.stringify({
        mutations: [
          {
            idempotencyKey: failKey,
            entityType: 'sync_test',
            entityId: 'rec-inexistente',
            operation: 'UPDATE',
            payload: { foo: 'bar' },
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ]);

    expect(res.rows[0].sync_push_mutations.results[0].status).toBe('rejected');

    // Comprobar que en sync_processed_mutations NO queda ninguna fila con failKey
    const checkAudit = await db.query(
      `SELECT * FROM public.sync_processed_mutations WHERE idempotency_key = $1;`,
      [failKey],
    );
    expect(checkAudit.rows.length).toBe(0);
  });

  it('12. La función opera con search_path = "" y referencias de esquema explícitas', async () => {
    // Comprobar que en pg_proc la función tiene proconfig con search_path = ''
    const procRes = await db.query<{ proconfig: string[] }>(`
      SELECT proconfig FROM pg_proc WHERE proname = 'sync_push_mutations';
    `);
    expect(procRes.rows.length).toBe(1);
    expect(procRes.rows[0].proconfig[0]).toMatch(/search_path=(""|=)/);
  });

  it('13. Excepción SQL real posterior a la reserva: la reserva processing se revierte y no queda huérfana', async () => {
    // Como superusuario / owner, agregamos una restricción CHECK en sync_test_records para forzar una excepción SQL en runtime
    await db.query(`RESET ROLE;`);
    await db.query(`
      ALTER TABLE public.sync_test_records
      ADD CONSTRAINT chk_test_crash CHECK ((payload->>'force_sql_crash')::boolean IS NOT TRUE);
    `);

    await setAuthContext(USER_A_ID, 'vendedor');

    const crashKey = '9'.repeat(64);
    const crashEntityId = 'rec-crash-pglite-001';

    try {
      const res = await db.query<{ sync_push_mutations: any }>(`SELECT public.sync_push_mutations($1::jsonb);`, [
        JSON.stringify({
          mutations: [
            {
              idempotencyKey: crashKey,
              entityType: 'sync_test',
              entityId: crashEntityId,
              operation: 'INSERT',
              payload: { force_sql_crash: true },
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      ]);

      const result = res.rows[0].sync_push_mutations.results[0];
      // La mutación debe ser reportada como 'failed' por la excepción SQL
      expect(result.status).toBe('failed');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Fallo en persistencia:.*chk_test_crash/);

      // Comprobar que en sync_processed_mutations NO queda NINGÚN registro con esa clave
      const checkAudit = await db.query(
        `SELECT * FROM public.sync_processed_mutations WHERE idempotency_key = $1;`,
        [crashKey],
      );
      expect(checkAudit.rows.length).toBe(0);

      // Comprobar que NO queda ningún registro en estado 'processing' en toda la tabla
      const checkProcessing = await db.query(
        `SELECT * FROM public.sync_processed_mutations WHERE status = 'processing';`,
      );
      expect(checkProcessing.rows.length).toBe(0);

      // Comprobar que no se insertó nada en la tabla de dominio
      const checkRecord = await db.query(
        `SELECT * FROM public.sync_test_records WHERE id = $1;`,
        [crashEntityId],
      );
      expect(checkRecord.rows.length).toBe(0);
    } finally {
      await db.query(`RESET ROLE;`);
      await db.query(`
        ALTER TABLE public.sync_test_records DROP CONSTRAINT IF EXISTS chk_test_crash;
      `);
    }
  });
});
