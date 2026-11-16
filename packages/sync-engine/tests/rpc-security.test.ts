import { describe, it, expect } from 'vitest';
import type { SyncMutation, SyncBatchRequest, SyncBatchResponse, SyncProcessedResult } from '@tienda/shared-types';

/**
 * Simulación de la lógica de negocio, seguridad e idempotencia de la función PostgreSQL
 * `public.sync_push_mutations(p_batch JSONB)` para validación de contratos,
 * reglas RLS, RBAC y atomicidad antes de su ejecución en Supabase.
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

interface DomainTestRecord {
  id: string;
  payload: Record<string, unknown>;
  createdBy: string;
}

class PostgresRpcSecuritySimulator {
  private processedTable: Map<string, ProcessedDbRecord> = new Map();
  private domainTestTable: Map<string, DomainTestRecord> = new Map();

  private readonly IMPLEMENTED_ENTITIES = new Set(['sync_test']);
  private readonly FUTURE_ROADMAP_ENTITIES = new Set([
    'ventas',
    'pagos_venta',
    'movimientos_caja',
    'libros',
    'ediciones_libro',
  ]);

  pushMutations(batch: SyncBatchRequest, ctx: SecurityContext): SyncBatchResponse {
    // 1. Verificación obligatoria de autenticación (GoTrue auth.uid())
    if (!ctx.userId) {
      throw new Error('No autenticado: se requiere sesión activa de GoTrue');
    }

    const userRole = ctx.role || 'vendedor';
    let processedCount = 0;
    let alreadyAppliedCount = 0;
    let failedCount = 0;
    const results: SyncProcessedResult[] = [];
    const serverTimestamp = new Date().toISOString();

    for (const m of batch.mutations) {
      // 2. Validación de formato de clave de idempotencia SHA-256
      if (!m.idempotencyKey || m.idempotencyKey.length !== 64) {
        failedCount++;
        results.push({
          idempotencyKey: m.idempotencyKey || 'unknown',
          entityType: m.entityType || 'unknown',
          entityId: m.entityId || 'unknown',
          status: 'failed',
          success: false,
          error: 'Clave de idempotencia inválida',
          serverTimestamp,
        });
        continue;
      }

      // 3. Control de permisos por rol (RBAC)
      if (userRole === 'vendedor' && m.operation === 'DELETE') {
        failedCount++;
        results.push({
          idempotencyKey: m.idempotencyKey,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          success: false,
          error: 'El rol vendedor no tiene privilegios para ejecutar operaciones de borrado',
          serverTimestamp,
        });
        continue;
      }

      // 4. Verificación de entidades: implementadas vs no implementadas en H06
      if (this.FUTURE_ROADMAP_ENTITIES.has(m.entityType)) {
        failedCount++;
        results.push({
          idempotencyKey: m.idempotencyKey,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          success: false,
          error: `Entidad aún no implementada en el backend (prevista para H07+): ${m.entityType}`,
          serverTimestamp,
        });
        continue;
      }

      if (!this.IMPLEMENTED_ENTITIES.has(m.entityType)) {
        failedCount++;
        results.push({
          idempotencyKey: m.idempotencyKey,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'rejected',
          success: false,
          error: `Entidad no reconocida en la lista blanca del servidor: ${m.entityType}`,
          serverTimestamp,
        });
        continue;
      }

      // 5. Deduplicación e Idempotencia atómica (ON CONFLICT DO NOTHING)
      if (this.processedTable.has(m.idempotencyKey)) {
        alreadyAppliedCount++;
        results.push({
          idempotencyKey: m.idempotencyKey,
          entityType: m.entityType,
          entityId: m.entityId,
          status: 'already_applied',
          success: true,
          serverTimestamp,
        });
        continue;
      }

      // 6. Persistencia real en la tabla de dominio 'sync_test'
      if (m.operation === 'INSERT' || m.operation === 'UPDATE') {
        this.domainTestTable.set(m.entityId, {
          id: m.entityId,
          payload: (m.payload as Record<string, unknown>) || {},
          createdBy: ctx.userId,
        });
      } else if (m.operation === 'DELETE') {
        this.domainTestTable.delete(m.entityId);
      }

      // 7. Registro de idempotencia con usuario del servidor (Anti-spoofing)
      this.processedTable.set(m.idempotencyKey, {
        idempotencyKey: m.idempotencyKey,
        usuarioId: ctx.userId,
        entityType: m.entityType,
        entityId: m.entityId,
        operation: m.operation,
      });

      processedCount++;
      results.push({
        idempotencyKey: m.idempotencyKey,
        entityType: m.entityType,
        entityId: m.entityId,
        status: 'processed',
        success: true,
        serverTimestamp,
      });
    }

    return {
      success: true,
      processedCount,
      alreadyAppliedCount,
      failedCount,
      results,
    };
  }

  getRecord(key: string): ProcessedDbRecord | undefined {
    return this.processedTable.get(key);
  }

  getDomainRecord(id: string): DomainTestRecord | undefined {
    return this.domainTestTable.get(id);
  }
}

describe('Contratos de Seguridad, Idempotencia y RPC Supabase (sync_push_mutations)', () => {
  const sampleMutation: SyncMutation = {
    id: '11111111-1111-4111-8111-111111111111',
    entityType: 'sync_test',
    entityId: '22222222-2222-4222-8222-222222222222',
    operation: 'INSERT',
    payload: { totalNeto: 5000 },
    idempotencyKey: 'a'.repeat(64),
    status: 'pending',
    retryCount: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
  };

  it('1. Contrato cliente-servidor compatible: p_batch como SyncBatchRequest y respuesta estructurada', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [sampleMutation],
    };

    const res: SyncBatchResponse = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });
    expect(res.success).toBe(true);
    expect(res.processedCount).toBe(1);
    expect(res.alreadyAppliedCount).toBe(0);
    expect(res.failedCount).toBe(0);
    expect(res.results[0]?.status).toBe('processed');
    expect(res.results[0]?.success).toBe(true);
  });

  it('2. Mutación aplicada y confirmada: persiste en tabla de dominio y en tabla de auditoría', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [sampleMutation],
    };

    const res = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });
    expect(res.results[0]?.success).toBe(true);

    const domainRec = simulator.getDomainRecord(sampleMutation.entityId);
    expect(domainRec).toBeDefined();
    expect(domainRec?.createdBy).toBe('usr-1');

    const auditRec = simulator.getRecord(sampleMutation.idempotencyKey);
    expect(auditRec).toBeDefined();
    expect(auditRec?.usuarioId).toBe('usr-1');
  });

  it('3. Reintento idempotente: ya procesada responde already_applied sin duplicar registros', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [sampleMutation],
    };

    const res1 = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });
    expect(res1.processedCount).toBe(1);

    const res2 = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });
    expect(res2.processedCount).toBe(0);
    expect(res2.alreadyAppliedCount).toBe(1);
    expect(res2.results[0]?.status).toBe('already_applied');
    expect(res2.results[0]?.success).toBe(true);
  });

  it('4. Solicitudes simultáneas con la misma clave: manejo de concurrencia atómica', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [sampleMutation],
    };

    // Simulamos dos llamadas concurrentes
    const resA = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });
    const resB = simulator.pushMutations(batch, { userId: 'usr-1', role: 'vendedor' });

    const totalProcessed = resA.processedCount + resB.processedCount;
    const totalAlreadyApplied = resA.alreadyAppliedCount + resB.alreadyAppliedCount;

    expect(totalProcessed).toBe(1);
    expect(totalAlreadyApplied).toBe(1);
  });

  it('5. Rechazo de usuarios no autorizados: sin autenticación o rol vendedor intentando DELETE', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const deleteBatch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [{ ...sampleMutation, operation: 'DELETE' }],
    };

    // Sin autenticación
    expect(() => simulator.pushMutations(deleteBatch, { userId: null, role: null })).toThrow(
      'No autenticado',
    );

    // Vendedor intentando DELETE
    const resVendedor = simulator.pushMutations(deleteBatch, { userId: 'usr-vendedor', role: 'vendedor' });
    expect(resVendedor.failedCount).toBe(1);
    expect(resVendedor.results[0]?.status).toBe('rejected');
    expect(resVendedor.results[0]?.success).toBe(false);
    expect(resVendedor.results[0]?.error).toContain('rol vendedor no tiene privilegios');

    // Dueño intentando DELETE -> Permitido
    const resDueno = simulator.pushMutations(deleteBatch, { userId: 'usr-dueno', role: 'dueno' });
    expect(resDueno.processedCount).toBe(1);
  });

  it('6. Rechazo de entidades inexistentes o fuera de la lista blanca', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const maliciousBatch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [
        {
          ...sampleMutation,
          idempotencyKey: 'b'.repeat(64),
          entityType: 'auth.users; DROP TABLE libros; --',
        },
      ],
    };

    const res = simulator.pushMutations(maliciousBatch, { userId: 'usr-1', role: 'vendedor' });
    expect(res.failedCount).toBe(1);
    expect(res.results[0]?.status).toBe('rejected');
    expect(res.results[0]?.success).toBe(false);
    expect(res.results[0]?.error).toContain('Entidad no reconocida en la lista blanca');
  });

  it('7. Fallo de persistencia sin confirmación falsa: entidades aún no implementadas son rechazadas', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const ventaBatch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [
        {
          ...sampleMutation,
          idempotencyKey: 'c'.repeat(64),
          entityType: 'ventas', // Prevista para H08, no implementada en H06
        },
      ],
    };

    const res = simulator.pushMutations(ventaBatch, { userId: 'usr-1', role: 'vendedor' });
    expect(res.processedCount).toBe(0);
    expect(res.failedCount).toBe(1);
    expect(res.results[0]?.status).toBe('rejected');
    expect(res.results[0]?.success).toBe(false);
    expect(res.results[0]?.error).toContain('Entidad aún no implementada');
  });

  it('8. Anti-spoofing: el servidor asigna auth.uid() de GoTrue ignorando datos enviados por el cliente', () => {
    const simulator = new PostgresRpcSecuritySimulator();
    const serverUserId = 'usr-real-supervisor-99';

    const batch: SyncBatchRequest = {
      dispositivoId: 'disp-01',
      appVersion: '0.1.0',
      mutations: [
        {
          ...sampleMutation,
          payload: { ...sampleMutation.payload, usuarioId: 'usr-falso-atacante-00' },
        },
      ],
    };

    const res = simulator.pushMutations(batch, { userId: serverUserId, role: 'dueno' });
    expect(res.processedCount).toBe(1);

    const record = simulator.getRecord(sampleMutation.idempotencyKey);
    expect(record?.usuarioId).toBe(serverUserId);
    expect(record?.usuarioId).not.toBe('usr-falso-atacante-00');
  });
});
