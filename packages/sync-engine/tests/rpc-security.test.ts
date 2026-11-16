import { describe, it, expect } from 'vitest';
import type { SyncMutation, SyncBatchRequest } from '@tienda/shared-types';

/**
 * Simulación de la lógica de negocio y seguridad de la función PostgreSQL
 * `public.sync_push_mutations(p_mutations JSONB)` para validación de contratos,
 * reglas RLS y restricciones de rol antes de su ejecución en Supabase.
 */
interface SecurityContext {
  userId: string | null;
  role: 'vendedor' | 'dueno' | 'administrador' | null;
}

interface ProcessedDbRecord {
  idempotencyKey: string;
  usuarioId: string;
  entityType: string;
  entityId: string;
  operation: string;
}

class PostgresRpcSecuritySimulator {
  private processedTable: Map<string, ProcessedDbRecord> = new Map();
  private readonly WHITELISTED_ENTITIES = new Set([
    'sync_test',
    'ventas',
    'pagos_venta',
    'movimientos_caja',
    'libros',
    'ediciones_libro',
  ]);

  pushMutations(batch: SyncBatchRequest, ctx: SecurityContext) {
    // 1. Verificación obligatoria de autenticación (GoTrue auth.uid())
    if (!ctx.userId) {
      throw new Error('No autenticado: se requiere sesión activa de GoTrue');
    }

    const userRole = ctx.role || 'vendedor';
    let processed = 0;
    let alreadyApplied = 0;
    let failed = 0;
    const results: Array<{ idempotencyKey: string; status: string; error?: string }> = [];

    for (const m of batch.mutations) {
      // 2. Validación de formato de clave de idempotencia SHA-256
      if (!m.idempotencyKey || m.idempotencyKey.length !== 64) {
        failed++;
        results.push({ idempotencyKey: m.idempotencyKey || 'unknown', status: 'failed', error: 'Clave de idempotencia inválida' });
        continue;
      }

      // 3. Lista blanca de entidades (Prevención de inyección SQL y acceso a tablas arbitrarias)
      if (!this.WHITELISTED_ENTITIES.has(m.entityType)) {
        failed++;
        results.push({
          idempotencyKey: m.idempotencyKey,
          status: 'failed',
          error: `Entidad no reconocida en la lista blanca del servidor: ${m.entityType}`,
        });
        continue;
      }

      // 4. Control de permisos por rol (RBAC)
      if (userRole === 'vendedor' && m.operation === 'DELETE') {
        failed++;
        results.push({
          idempotencyKey: m.idempotencyKey,
          status: 'failed',
          error: 'El rol vendedor no tiene privilegios para ejecutar operaciones de borrado',
        });
        continue;
      }

      // 5. Deduplicación e Idempotencia
      if (this.processedTable.has(m.idempotencyKey)) {
        alreadyApplied++;
        results.push({ idempotencyKey: m.idempotencyKey, status: 'already_applied' });
        continue;
      }

      // 6. Asignación obligatoria del usuario autenticado del servidor (Anti-spoofing)
      this.processedTable.set(m.idempotencyKey, {
        idempotencyKey: m.idempotencyKey,
        usuarioId: ctx.userId, // Servidor asigna auth.uid(), IGNORA lo que mande el cliente
        entityType: m.entityType,
        entityId: m.entityId,
        operation: m.operation,
      });

      processed++;
      results.push({ idempotencyKey: m.idempotencyKey, status: 'processed' });
    }

    return {
      success: true,
      processed,
      alreadyApplied,
      failed,
      results,
    };
  }

  getRecord(key: string): ProcessedDbRecord | undefined {
    return this.processedTable.get(key);
  }
}

describe('Contratos de Seguridad e Idempotencia de RPC Supabase (sync_push_mutations)', () => {
  const sampleMutation: SyncMutation = {
    id: '11111111-1111-4111-8111-111111111111',
    entityType: 'ventas',
    entityId: '22222222-2222-4222-8222-222222222222',
    operation: 'INSERT',
    payload: { totalNeto: 5000 },
    idempotencyKey: 'a'.repeat(64),
    status: 'pending',
    retryCount: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
  };

  it('rechaza solicitudes de clientes no autenticados sin token GoTrue', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      mutations: [sampleMutation],
    };

    expect(() => simulator.pushMutations(batch, { userId: null, role: null })).toThrow(
      'No autenticado: se requiere sesión activa de GoTrue',
    );
  });

  it('asigna el usuario_id del servidor derivado de auth.uid() ignorando spoofing del cliente', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const serverUserId = 'usr-real-supervisor-99';

    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      mutations: [
        {
          ...sampleMutation,
          payload: { ...sampleMutation.payload, usuarioId: 'usr-falso-atacante-00' },
        },
      ],
    };

    const res = simulator.pushMutations(batch, { userId: serverUserId, role: 'dueno' });
    expect(res.processed).toBe(1);

    const record = simulator.getRecord(sampleMutation.idempotencyKey);
    expect(record?.usuarioId).toBe(serverUserId);
    expect(record?.usuarioId).not.toBe('usr-falso-atacante-00');
  });

  it('rechaza nombres de tablas o entidades arbitrarias fuera de la lista blanca', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const maliciousBatch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      mutations: [
        {
          ...sampleMutation,
          idempotencyKey: 'b'.repeat(64),
          entityType: 'auth.users; DROP TABLE libros; --',
        },
      ],
    };

    const res = simulator.pushMutations(maliciousBatch, { userId: 'usr-1', role: 'vendedor' });
    expect(res.failed).toBe(1);
    expect(res.results[0]?.error).toContain('Entidad no reconocida en la lista blanca');
  });

  it('bloquea operaciones de eliminación para el rol vendedor según RBAC', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const deleteBatch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      mutations: [
        {
          ...sampleMutation,
          idempotencyKey: 'c'.repeat(64),
          operation: 'DELETE',
        },
      ],
    };

    // Vendedor intenta DELETE -> Bloqueado
    const resVendedor = simulator.pushMutations(deleteBatch, { userId: 'usr-vendedor-1', role: 'vendedor' });
    expect(resVendedor.failed).toBe(1);
    expect(resVendedor.results[0]?.error).toContain('rol vendedor no tiene privilegios');

    // Dueño intenta DELETE -> Permitido
    const resDueno = simulator.pushMutations(deleteBatch, { userId: 'usr-dueno-1', role: 'dueno' });
    expect(resDueno.processed).toBe(1);
  });

  it('procesa reintentos de red de forma estrictamente idempotente (already_applied)', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      mutations: [sampleMutation],
    };

    // Primer envío: procesado con éxito
    const res1 = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });
    expect(res1.processed).toBe(1);
    expect(res1.alreadyApplied).toBe(0);

    // Segundo envío (reintento por fallo de red tras confirmación en BD): deduplicado
    const res2 = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });
    expect(res2.processed).toBe(0);
    expect(res2.alreadyApplied).toBe(1);
    expect(res2.results[0]?.status).toBe('already_applied');
  });
});
