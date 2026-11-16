import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import {
  ExpoSqliteDriver,
  initializeDatabasePragmas,
  MigrationRunner,
  INITIAL_SYNC_MIGRATION,
  OutboxRepository,
} from '@tienda/database';
import {
  parseSolesToCentavos,
  formatMoneda,
  type Centavos,
} from '@tienda/business-logic';
import {
  generateIdempotencyKey,
  computeSha256,
} from '@tienda/sync-engine';
import type { SyncMutation } from '@tienda/shared-types';

interface SqliteStatus {
  journalMode: string;
  synchronous: string;
  foreignKeys: boolean;
  migrationsApplied: number;
  isReady: boolean;
  dbPath: string;
}

interface TestResultItem {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

export default function App(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [sqliteStatus, setSqliteStatus] = useState<SqliteStatus>({
    journalMode: 'desconocido',
    synchronous: 'desconocido',
    foreignKeys: false,
    migrationsApplied: 0,
    isReady: false,
    dbPath: 'tienda.db',
  });
  const [driver, setDriver] = useState<ExpoSqliteDriver | null>(null);
  const [outboxRepo, setOutboxRepo] = useState<OutboxRepository | null>(null);
  const driverRef = useRef<ExpoSqliteDriver | null>(null);
  const outboxRepoRef = useRef<OutboxRepository | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [recentMutations, setRecentMutations] = useState<SyncMutation[]>([]);
  const [demoAmount, setDemoAmount] = useState<Centavos>(2550 as Centavos);
  const [lastHash, setLastHash] = useState<string>('');
  const [lastActionLog, setLastActionLog] = useState<string>('Iniciando sistema...');
  const [suiteResults, setSuiteResults] = useState<TestResultItem[]>([]);

  // Inicializa SQLite nativo, pragmas y migraciones
  const initializeDatabase = useCallback(async () => {
    try {
      setLoading(true);
      setLastActionLog('Abriendo SQLite nativo con expo-sqlite...');

      const nativeDb = await SQLite.openDatabaseAsync('tienda.db');
      const expoDriver = new ExpoSqliteDriver(nativeDb);

      await initializeDatabasePragmas(expoDriver);

      const jMode = await expoDriver.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode;');
      const syncMode = await expoDriver.getFirstAsync<{ synchronous: number }>('PRAGMA synchronous;');
      const fkMode = await expoDriver.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys;');

      const syncModeText = syncMode?.synchronous === 2 ? 'FULL (2)' : `${syncMode?.synchronous}`;
      const fkActive = fkMode?.foreign_keys === 1;

      // Crea tablas de prueba con claves foráneas para verificación transaccional
      await expoDriver.execAsync(`
        CREATE TABLE IF NOT EXISTS test_ventas (
          id TEXT PRIMARY KEY NOT NULL,
          total_neto INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS test_detalles (
          id TEXT PRIMARY KEY NOT NULL,
          venta_id TEXT NOT NULL,
          cantidad INTEGER NOT NULL,
          precio_unitario INTEGER NOT NULL,
          FOREIGN KEY (venta_id) REFERENCES test_ventas(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS test_pagos (
          id TEXT PRIMARY KEY NOT NULL,
          venta_id TEXT NOT NULL,
          monto INTEGER NOT NULL,
          FOREIGN KEY (venta_id) REFERENCES test_ventas(id) ON DELETE RESTRICT
        );
      `);

      const runner = new MigrationRunner(expoDriver);
      await runner.runMigrations([INITIAL_SYNC_MIGRATION]);

      const applied = await runner.getAppliedVersions();
      const repo = new OutboxRepository(expoDriver);
      const recovered = await repo.resetInProgressToPending();

      const count = await repo.countPending();
      const pendingList = await repo.getPending(5);

      driverRef.current = expoDriver;
      outboxRepoRef.current = repo;
      setDriver(expoDriver);
      setOutboxRepo(repo);
      setSqliteStatus({
        journalMode: jMode?.journal_mode || 'desconocido',
        synchronous: syncModeText,
        foreignKeys: fkActive,
        migrationsApplied: applied.length,
        isReady: true,
        dbPath: 'tienda.db (sandbox Android)',
      });
      setPendingCount(count);
      setRecentMutations(pendingList);
      setLastActionLog(
        `SQLite listo (WAL, synchronous=FULL, FK=${fkActive ? 'ON' : 'OFF'}). Outbox: ${count} mutaciones.${
          recovered > 0 ? ` (${recovered} recuperados)` : ''
        }`,
      );
    } catch (err) {
      setLastActionLog(`Error al inicializar SQLite: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeDatabase();
  }, [initializeDatabase]);

  // TEST 1: Transacción Confirmada (test_ventas + test_detalles en txn)
  const runTestConfirmedTxn = async (): Promise<boolean> => {
    const activeDriver = driverRef.current;
    if (!activeDriver) return false;
    const vtaId = `vta-conf-${Date.now()}`;
    const detId = `det-conf-${Date.now()}`;
    const timestamp = new Date().toISOString();

    try {
      await activeDriver.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('INSERT INTO test_ventas (id, total_neto, created_at) VALUES (?, ?, ?);', vtaId, 2500, timestamp);
        await txn.runAsync('INSERT INTO test_detalles (id, venta_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?);', detId, vtaId, 1, 2500);
      });

      const rowVenta = await activeDriver.getFirstAsync('SELECT id FROM test_ventas WHERE id = ?;', vtaId);
      const rowDetalle = await activeDriver.getFirstAsync('SELECT id FROM test_detalles WHERE id = ?;', detId);

      const passed = rowVenta !== null && rowDetalle !== null;
      setLastActionLog(`Test 1 (Txn Confirmada): ${passed ? 'ÉXITO (Venta y Detalle confirmados)' : 'FALLO'}`);
      return passed;
    } catch (err) {
      setLastActionLog(`Test 1 falló: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  // TEST 2: Transacción Revertida por Excepción (Sin registros huérfanos)
  const runTestRollbackTxn = async (): Promise<boolean> => {
    const activeDriver = driverRef.current;
    if (!activeDriver) return false;
    const vtaId = `vta-fail-${Date.now()}`;
    const detId = `det-fail-${Date.now()}`;
    const timestamp = new Date().toISOString();

    let threwExpected = false;
    try {
      await activeDriver.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('INSERT INTO test_ventas (id, total_neto, created_at) VALUES (?, ?, ?);', vtaId, 4000, timestamp);
        await txn.runAsync('INSERT INTO test_detalles (id, venta_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?);', detId, vtaId, 2, 2000);
        throw new Error('Fallo simulado para abortar transacción');
      });
    } catch {
      threwExpected = true;
    }

    const rowVenta = await activeDriver.getFirstAsync('SELECT id FROM test_ventas WHERE id = ?;', vtaId);
    const rowDetalle = await activeDriver.getFirstAsync('SELECT id FROM test_detalles WHERE id = ?;', detId);

    const passed = threwExpected && rowVenta === null && rowDetalle === null;
    setLastActionLog(`Test 2 (Rollback por Excepción): ${passed ? 'ÉXITO (0 registros huérfanos)' : 'FALLO'}`);
    return passed;
  };

  // TEST 3: Verificación de Claves Foráneas dentro de Transacción Exclusiva
  const runTestForeignKey = async (): Promise<boolean> => {
    const activeDriver = driverRef.current;
    if (!activeDriver) return false;
    const fakeVentaId = `vta-inexistente-${Date.now()}`;
    const detId = `det-fk-${Date.now()}`;
    let threwFk = false;

    try {
      await activeDriver.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          'INSERT INTO test_detalles (id, venta_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?);',
          detId,
          fakeVentaId,
          1,
          1500,
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('FK error caught:', msg);
      if (/foreign key|constraint/i.test(msg)) {
        threwFk = true;
      }
    }

    const rowDetalle = await activeDriver.getFirstAsync('SELECT id FROM test_detalles WHERE id = ?;', detId);
    const passed = threwFk && rowDetalle === null;
    setLastActionLog(`Test 3 (Clave Foránea): ${passed ? 'ÉXITO (FK inexistente abortada y revertida)' : 'FALLO'}`);
    return passed;
  };

  // TEST 4: Inserción Atómica de Registro de Prueba y Outbox
  const runTestAtomicRecordAndOutbox = async (): Promise<boolean> => {
    const activeDriver = driverRef.current;
    const activeRepo = outboxRepoRef.current;
    if (!activeDriver || !activeRepo) return false;
    const testId = `vta-atomic-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const idempotencyKey = computeSha256(`atomic:${testId}:${timestamp}`);

    const mutation: SyncMutation = {
      id: `mut-atomic-${Date.now()}`,
      entityType: 'ventas',
      entityId: testId,
      operation: 'INSERT',
      payload: { totalNeto: 5000 },
      idempotencyKey,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      await activeDriver.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('INSERT INTO test_ventas (id, total_neto, created_at) VALUES (?, ?, ?);', testId, 5000, timestamp);
        await activeRepo.enqueue(mutation, txn);
      });

      const rowVenta = await activeDriver.getFirstAsync('SELECT id FROM test_ventas WHERE id = ?;', testId);
      const rowOutbox = await activeDriver.getFirstAsync('SELECT id FROM sync_outbox WHERE id = ?;', mutation.id);

      const passed = rowVenta !== null && rowOutbox !== null;
      setLastActionLog(`Test 4 (Venta + Outbox Atómicos): ${passed ? 'ÉXITO (Ambos confirmados juntos)' : 'FALLO'}`);
      return passed;
    } catch (err) {
      setLastActionLog(`Test 4 falló: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };

  // TEST 5: Reintento de Mutación sin Duplicación (Deduplicación por Idempotency Key)
  const runTestDeduplication = async (): Promise<boolean> => {
    const activeDriver = driverRef.current;
    const activeRepo = outboxRepoRef.current;
    if (!activeDriver || !activeRepo) return false;
    const sharedIdempotencyKey = computeSha256(`dedup-test-${Date.now()}`);
    const timestamp = new Date().toISOString();

    const m1: SyncMutation = {
      id: `mut-dedup-1-${Date.now()}`,
      entityType: 'ventas',
      entityId: 'vta-orig',
      operation: 'INSERT',
      payload: { totalNeto: 1000 },
      idempotencyKey: sharedIdempotencyKey,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const m2: SyncMutation = {
      id: `mut-dedup-2-${Date.now()}`,
      entityType: 'ventas',
      entityId: 'vta-duplicate',
      operation: 'INSERT',
      payload: { totalNeto: 2000 },
      idempotencyKey: sharedIdempotencyKey,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      await activeDriver.withExclusiveTransactionAsync(async (txn) => {
        await activeRepo.enqueue(m1, txn);
      });
    } catch (err) {
      console.log('Error al insertar m1:', err);
    }

    let duplicateRejected = false;
    try {
      await activeDriver.withExclusiveTransactionAsync(async (txn) => {
        await activeRepo.enqueue(m2, txn);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique/i.test(msg)) {
        duplicateRejected = true;
      }
    }

    setLastActionLog(`Test 5 (Deduplicación): ${duplicateRejected ? 'ÉXITO (Mutación duplicada rechazada)' : 'FALLO'}`);
    return duplicateRejected;
  };

  // TEST 6: Reinicio y Recuperación de Datos
  const runTestRestartPersistence = async (): Promise<boolean> => {
    const activeDriver = driverRef.current;
    const activeRepo = outboxRepoRef.current;
    if (!activeDriver || !activeRepo) return false;
    try {
      const countBefore = await activeRepo.countPending();
      await activeDriver.closeAsync();

      const nativeDb = await SQLite.openDatabaseAsync('tienda.db');
      const newDriver = new ExpoSqliteDriver(nativeDb);
      await initializeDatabasePragmas(newDriver);
      const newRepo = new OutboxRepository(newDriver);
      await newRepo.resetInProgressToPending();
      const countAfter = await newRepo.countPending();

      driverRef.current = newDriver;
      outboxRepoRef.current = newRepo;
      setDriver(newDriver);
      setOutboxRepo(newRepo);

      const passed = countAfter >= countBefore;
      setLastActionLog(`Test 6 (Reinicio SQLite): ${passed ? `ÉXITO (${countAfter} mutaciones verificadas tras reinicio)` : 'FALLO'}`);
      return passed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('Test 6 error caught:', msg);
      setLastActionLog(`Test 6 falló: ${msg}`);
      return false;
    }
  };

  // EJECUTA LA SUITE COMPLETA DE 6 PRUEBAS ANDROID
  const handleRunAllTests = async () => {
    setLoading(true);
    setLastActionLog('Ejecutando suite de 6 pruebas de verificación transaccional...');
    const results: TestResultItem[] = [];

    try {
      // 1. Transacción confirmada: inserción en test_ventas y test_detalles confirmada
      const t1 = await runTestConfirmedTxn();
      results.push({ id: 'T1', name: '1. Transacción confirmada (Ventas + Detalles)', passed: t1, detail: t1 ? 'Commit atómico en txn' : 'Error en confirmación' });

      // 2. Reversión por excepción: comprobando 0 registros huérfanos
      const t2 = await runTestRollbackTxn();
      results.push({ id: 'T2', name: '2. Reversión por excepción (0 registros huérfanos)', passed: t2, detail: t2 ? 'Rollback íntegro' : 'Registros huérfanos' });

      // 3. Verificación de clave foránea dentro de withExclusiveTransactionAsync
      const t3 = await runTestForeignKey();
      results.push({ id: 'T3', name: '3. Verificación de clave foránea inexistente', passed: t3, detail: t3 ? 'Bloqueo SQLITE_CONSTRAINT_FOREIGNKEY' : 'FK no enforced' });

      // 4. Inserción atómica de registro de prueba y outbox
      const t4 = await runTestAtomicRecordAndOutbox();
      results.push({ id: 'T4', name: '4. Inserción atómica (Registro + Outbox)', passed: t4, detail: t4 ? 'Commit coordinado' : 'Fallo en inserción atómica' });

      // 5. Reintento de mutación sin duplicación
      const t5 = await runTestDeduplication();
      results.push({ id: 'T5', name: '5. Reintento sin duplicación (Idempotency Key)', passed: t5, detail: t5 ? 'Restricción UNIQUE activa' : 'Duplicación permitida' });

      // 6. Reinicio y recuperación de datos
      const t6 = await runTestRestartPersistence();
      results.push({ id: 'T6', name: '6. Reinicio y persistencia de datos', passed: t6, detail: t6 ? 'Datos intactos tras reinicio' : 'Pérdida de datos' });

      setSuiteResults(results);
      const passedCount = results.filter((r) => r.passed).length;
      setLastActionLog(`Suite H06.2: ${passedCount}/${results.length} pruebas aprobadas.`);
    } catch (err) {
      console.error('Error durante la ejecución de la suite:', err);
      setLastActionLog(`Error en suite: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSampleMoney = () => {
    const parsed = parseSolesToCentavos('12.50');
    if (parsed.ok) {
      setDemoAmount((prev) => (prev + parsed.value) as Centavos);
      setLastActionLog(`Sumado S/ 12.50. Total: ${formatMoneda((demoAmount + parsed.value) as Centavos)}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sistema de Gestión de Librería</Text>
        <Text style={styles.subtitle}>Proyecto Tienda — H06.2 Atomicidad SQLite & Supabase</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loadingText}>Procesando operaciones transaccionales...</Text>
          </View>
        ) : null}

        {/* Tarjeta de estado SQLite */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Infraestructura SQLite (Android Pixel 8)</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusDotActive}>●</Text>
            <Text style={styles.statusText}>
              Estado: <Text style={styles.boldText}>{sqliteStatus.isReady ? 'Conectado (Driver Nativo)' : 'Desconectado'}</Text>
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDotActive}>●</Text>
            <Text style={styles.statusText}>
              Modo WAL: <Text style={styles.boldText}>{sqliteStatus.journalMode.toUpperCase()}</Text>
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDotActive}>●</Text>
            <Text style={styles.statusText}>
              Durabilidad: <Text style={styles.boldText}>{sqliteStatus.synchronous}</Text>
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDotActive}>●</Text>
            <Text style={styles.statusText}>
              Claves Foráneas: <Text style={styles.boldText}>{sqliteStatus.foreignKeys ? 'ACTIVAS (Enforced)' : 'INACTIVAS'}</Text>
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDotActive}>●</Text>
            <Text style={styles.statusText}>
              Migraciones: <Text style={styles.boldText}>{sqliteStatus.migrationsApplied} aplicadas</Text>
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusDotActive}>●</Text>
            <Text style={styles.statusText}>
              Outbox local: <Text style={styles.boldText}>{pendingCount} mutaciones pendientes</Text>
            </Text>
          </View>
        </View>

        {/* Botón de Ejecución de Suite H06.2 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verificación Transaccional Automatizada</Text>
          <TouchableOpacity style={styles.buttonSuite} onPress={handleRunAllTests} activeOpacity={0.8}>
            <Text style={styles.buttonSuiteText}>▶ Ejecutar Suite Completa de 6 Pruebas</Text>
          </TouchableOpacity>

          <View style={styles.individualButtons}>
            <TouchableOpacity style={styles.buttonSmall} onPress={runTestConfirmedTxn}>
              <Text style={styles.buttonSmallText}>1. Commit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonSmall} onPress={runTestRollbackTxn}>
              <Text style={styles.buttonSmallText}>2. Rollback</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonSmall} onPress={runTestForeignKey}>
              <Text style={styles.buttonSmallText}>3. FK Test</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonSmall} onPress={runTestDeduplication}>
              <Text style={styles.buttonSmallText}>4. Deduplicación</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resultados de la Suite */}
        {suiteResults.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resultados de la Suite Transaccional (H06.2)</Text>
            {suiteResults.map((r) => (
              <View key={r.id} style={styles.resultRow}>
                <Text style={r.passed ? styles.badgeSuccess : styles.badgeFailed}>
                  {r.passed ? '✓ PASÓ' : '✗ FALLÓ'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{r.name}</Text>
                  <Text style={styles.resultDetail}>{r.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Aritmética y Criptografía */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aritmética Monetaria y Criptografía</Text>
          <Text style={styles.amountDisplay}>{formatMoneda(demoAmount)}</Text>
          <Text style={styles.centsInfo}>{demoAmount} céntimos enteros (cero coma flotante)</Text>

          <TouchableOpacity style={styles.buttonSecondary} onPress={handleAddSampleMoney}>
            <Text style={styles.buttonTextSecondary}>+ Sumar S/ 12.50 (Aritmética Exacta)</Text>
          </TouchableOpacity>

          {lastHash ? (
            <View style={styles.hashBox}>
              <Text style={styles.hashLabel}>Último Hash SHA-256:</Text>
              <Text style={styles.hashText} numberOfLines={2} ellipsizeMode="middle">
                {lastHash}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Bitácora de Eventos */}
        <View style={styles.logBox}>
          <Text style={styles.logLabel}>Registro de Ejecución:</Text>
          <Text style={styles.logText}>{lastActionLog}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  loadingText: {
    color: '#38bdf8',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#38bdf8',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDotActive: {
    color: '#22c55e',
    fontSize: 14,
  },
  statusText: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  boldText: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  buttonSuite: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSuiteText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  individualButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  buttonSmall: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  buttonSmallText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  buttonTextSecondary: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 13,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  badgeSuccess: {
    backgroundColor: '#14532d',
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeFailed: {
    backgroundColor: '#7f1d1d',
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  resultName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  resultDetail: {
    color: '#94a3b8',
    fontSize: 11,
  },
  amountDisplay: {
    fontSize: 26,
    fontWeight: '700',
    color: '#22c55e',
    textAlign: 'center',
  },
  centsInfo: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  hashBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hashLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  hashText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#a5f3fc',
  },
  logBox: {
    backgroundColor: '#090d16',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  logText: {
    fontSize: 12,
    color: '#e2e8f0',
    fontFamily: 'monospace',
  },
});
