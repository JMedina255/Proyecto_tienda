# Registro de Cambios (CHANGELOG.md)

Todas las modificaciones notables en este proyecto serán documentadas en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.5] - 2026-11-15 (Hito H06.5 — Cierre de Idempotencia y Preparación de Despliegue Supabase)

### Añadido
- **Pruebas de Concurrencia Multi-Conexión Real en PostgreSQL (`packages/sync-engine/tests/postgres-concurrency.test.ts`):**
  - Validación con 2 conexiones TCP independientes concurrentes hacia un servidor PostgreSQL 16 aislado en puerto local 5433:
    1. Dos solicitudes paralelas idénticas: serialización a nivel de índice atómico, una sola aplicación física en `sync_test_records`, una respuesta `processed` y una respuesta `already_applied`.
    2. Dos solicitudes paralelas con misma clave y distinto `payload`: una aplicación física exitosa y rechazo inmediato de la colisión (`status: 'rejected'`).
    3. Excepción SQL real en dominio (restricción CHECK): reversión inmediata de la reserva `processing`, verificación de cero registros huérfanos y respuesta `failed`.
  - Semántica estricta de omisión (`ctx.skip()`): no contabiliza como PASS pruebas en ausencia de servidor local PostgreSQL en 5433.
  - Validación de seguridad de entorno: fallo inmediato si se intenta ejecutar contra un host distinto a `127.0.0.1`/`localhost` o un puerto distinto a `5433`.
- **Nuevas Pruebas en Suite PostgreSQL (`packages/sync-engine/tests/postgres-sync.test.ts`):**
  - Detección y rechazo de reutilización de clave con distinto `payload` (`status: 'rejected'`, `success: false`).
  - Rollback completo y reversión de la reserva de idempotencia ante fallos en la operación de dominio (cero huérfanos).
  - Rechazo de mutaciones financieras aún no implementadas (`ventas`, `pagos_venta`, `movimientos_caja`).
  - Prueba 13: Excepción SQL en runtime provocada por restricción CHECK en tabla de dominio; verificación de reversión atómica de la reserva `processing` (cero registros huérfanos).
- **Protocolo de Despliegue Controlado en Supabase (`docs/04-seguridad/HARDENING.md` §2.10):**
  - Especificación formal de pre-requisitos, inventario de 9 objetos de base de datos a desplegar, procedimiento dry-run (`npx supabase db push --dry-run --remote`) y 5 consultas SQL de verificación post-despliegue en producción sin tocar datos reales.

### Corregido
- **Reserva Atómica Previa y Reversión ante Excepciones (`supabase/migrations/20261115000001_sync_infrastructure.sql`):**
  - Inserción previa de la clave de idempotencia con estado `'processing'` dentro de un bloque `BEGIN ... EXCEPTION ... END` por mutación.
  - Ante cualquier excepción SQL o fallo de persistencia, PostgreSQL revierte automáticamente la subtransacción, y el bloque `EXCEPTION` ejecuta `DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;` como defensa en profundidad, garantizando que jamás quede un registro huérfano con estado `processing`.
  - Comparación completa de parámetros y contenido (`payload IS DISTINCT FROM v_payload`): rechazo si el payload difiere.
  - Comprobación estricta de estado previo: únicamente estados `'processed'` o `'already_applied'` pueden retornar `already_applied`; cualquier mutación previa con estado `'processing'`, `'failed'` o `'rejected'` se rechaza explícitamente.
  - Actualización a `'processed'` únicamente tras verificar que las filas afectadas en la tabla de dominio son mayores a cero (`ROW_COUNT > 0`).

### Verificado
- **Pruebas Automatizadas Aprobadas (100% PASS):**
  - 14 en `@tienda/business-logic`
  - 19 en `@tienda/database`
  - 36 en `@tienda/sync-engine` con PostgreSQL TCP 5433 activo (13 en PGlite, 3 de concurrencia multi-conexión TCP en PostgreSQL real, 20 unitarias/simuladas). Total: **69 pruebas ejecutadas y aprobadas**.
  - En ausencia de PostgreSQL TCP local: 66 pruebas ejecutadas y aprobadas, 3 pruebas omitidas explícitamente (`skipped`), 0 pendientes.
- **Comprobación de Tipos TypeScript (`pnpm typecheck`):** 9/9 tareas exitosas sin errores.
- **Auditoría Supabase CLI y Base Remota:**
  - Versión Supabase CLI: 3.1.0 (`npx supabase --version`).
  - Proyecto vinculado verificado: `hixrwpiyyhrifsxgekfe` (`supabase/config.toml` y `supabase/.temp/project-ref`).
  - Migraciones remotas existentes: 0 migraciones (`supabase_mcp.list_migrations`).
  - Tablas públicas remotas existentes: 0 tablas (`supabase_mcp.list_tables`).
  - Cero escrituras ejecutadas en producción; base remota preservada intacta.

---

## [0.1.4] - 2026-11-15 (Hito H06.4 — Auditoría Final de Seguridad y Validación PostgreSQL)

### Añadido
- **Suite de Pruebas Reales en PostgreSQL Aislado (`packages/sync-engine/tests/postgres-sync.test.ts`):**
  - 10 pruebas automatizadas ejecutadas contra una instancia real de PostgreSQL 18 (motor WebAssembly compilado con soporte completo de PL/pgSQL, RLS y restricciones):
    1. Rechazo de ejecución sin sesión activa de GoTrue (SQLSTATE 28000 o denegación de privilegios `EXECUTE`).
    2. Validación de límites de lote (rechazo de lotes vacíos o superiores a 100 mutaciones).
    3. Aplicación de `INSERT` válido en tabla real de dominio `sync_test_records` y auditoría en `sync_processed_mutations`.
    4. Cumplimiento estricto de RLS: usuario regular no puede leer registros creados por otros usuarios (`FORCE ROW LEVEL SECURITY`).
    5. Prevención de suplantación de `usuarioId`: asignación estricta desde `auth.uid()`.
    6. Rechazo de `UPDATE` no autorizado sobre registros ajenos (`Permiso denegado: no es propietario`).
    7. RBAC y propiedad en `DELETE`: rol `vendedor` bloqueado y usuarios ajenos rechazados.
    8. Verificación de filas afectadas (`ROW_COUNT`): rechazo con `success: false` si un `UPDATE` o `DELETE` afecta 0 filas.
    9. Idempotencia reforzada: reintento idéntico retorna `already_applied`; reutilización de claves con parámetros alterados es rechazada (`status: 'rejected'`).
    10. Verificación de seguridad en catálogo: función configurada con `SET search_path = ''` (`proconfig = ['search_path=""']`).
- **Dependencia de Desarrollo (`packages/sync-engine/package.json`):**
  - Incorporación de `@electric-sql/pglite` como motor PostgreSQL aislado para pruebas de integración SQL sin tocar producción.

### Corregido
- **Hardening Completo de RPC en PostgreSQL (`supabase/migrations/20261115000001_sync_infrastructure.sql`):**
  - Inmunidad total contra secuestro de esquema (CWE-426) mediante `SET search_path = ''` y cualificación explícita de identificadores (`public.`, `pg_catalog.`, `auth.`).
  - Sustitución de `pg_catalog.trim` por `pg_catalog.btrim` y uso de la forma sintáctica estándar `COALESCE(...)`.
  - Habilitación de `FORCE ROW LEVEL SECURITY` en `sync_test_records` y `sync_processed_mutations` para garantizar que las políticas apliquen sin excepción.
  - Validación de existencia y propiedad previa en operaciones `UPDATE` y `DELETE`, abortando si `ROW_COUNT = 0`.
  - Verificación estricta de concordancia en reintentos idempotentes: si una clave existente tiene discrepancias en usuario, entidad u operación, se rechaza de inmediato.
  - Revocación estricta de privilegios: `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role;`.

### Verificado
- **63 Pruebas Automatizadas Aprobadas en el Monorepo (100% PASS):**
  - 14 en `@tienda/business-logic`
  - 19 en `@tienda/database`
  - 30 en `@tienda/sync-engine` (incluyendo 10 pruebas reales de PostgreSQL)
- **Comprobación de Tipos TypeScript (`pnpm typecheck`):** 9/9 tareas exitosas sin advertencias.
- **Protección de Producción:** Cero escrituras, cero migraciones y cero usuarios creados en el proyecto remoto `hixrwpiyyhrifsxgekfe`.

---

## [0.1.3] - 2026-11-15 (Hito H06.3 — Contratos y Seguridad de Sincronización)

### Añadido
- **Unificación de Contratos de Sincronización (`packages/shared-types/src/sync.ts` y `src/rpc.ts`):**
  - Estandarización de `SyncBatchRequest` con soporte para objeto `{ dispositivoId, appVersion, mutations, usuarioId? }` y array de mutaciones.
  - Estandarización de `SyncBatchResponse` (`success`, `processedCount`, `alreadyAppliedCount`, `failedCount`, `results`) y `SyncProcessedResult` (`idempotencyKey`, `entityType`, `entityId`, `status: MutationSyncStatus`, `success: boolean`, `error?`, `serverTimestamp`).
  - Tipo discriminado `MutationSyncStatus = 'processed' | 'already_applied' | 'rejected' | 'failed'`.
- **Suite de Pruebas de Seguridad y Contratos RPC (`packages/sync-engine/tests/rpc-security.test.ts`):**
  - 8 pruebas de validación automatizada:
    1. Contrato cliente-servidor compatible (`SyncBatchRequest` y `SyncBatchResponse`).
    2. Mutación válida aplicada y registrada en `sync_processed_mutations`.
    3. Reintento idempotente que retorna `already_applied` con `success: true`.
    4. Concurrencia atómica de claves de idempotencia (`ON CONFLICT (idempotency_key) DO NOTHING`).
    5. Rechazo inmediato de usuario no autenticado o suplantación de `usuario_id`.
    6. Rechazo explícito de entidades no implementadas (hoja de ruta H07+) con `status: 'rejected'` y `success: false`.
    7. Fallo en persistencia sin falsas confirmaciones (el cliente marca `failed`, nunca `synced`).
    8. Recuperación ante respuestas incompletas de lotes (mutaciones omitidas marcadas como `failed` para reintento).
- **Aislamiento Estricto de Transacciones en SQLite (`packages/database/src/expo-driver.ts`):**
  - `ExpoTransactionContextDriver` que ejecuta operaciones transaccionales bajo el contexto directo de la transacción mientras bloquea y serializa llamadas concurrentes a `driver.execAsync` y `driver.runAsync` mediante `this.mutex.runExclusive`.
  - Prueba de concurrencia y serialización añadida en `packages/database/tests/expo-driver.test.ts`.

### Corregido
- **Prevención de Falsa Confirmación en Cliente (`packages/sync-engine/src/dispatcher.ts`):**
  - El cliente solo marca como `synced` si `result.success === true` y su estado es `'processed'` o `'already_applied'`.
  - Rechazos del servidor o errores de negocio marcan la mutación como `failed` con su causa, evitando borrado o confirmación ilegítima en el Outbox local.
  - Respuestas de lote incompletas (omisiones) son detectadas y marcadas como `failed` para evitar que queden atascadas en `in_progress`.
- **Función RPC de PostgreSQL Idempotente y Transaccional (`supabase/migrations/20261115000001_sync_infrastructure.sql`):**
  - Creación de tabla real de dominio `public.sync_test_records` para pruebas de integración de sincronización con RLS.
  - Manejo atómico de concurrencia mediante `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_inserted_id` en una única transacción sin bloqueos de aplicación.
  - Persistencia de registros de dominio y auditoría en `sync_processed_mutations` atómica (ambos o ninguno).
  - Rechazo explícito de entidades no implementadas (`ventas`, `pagos_venta`, `movimientos_caja`, etc.) con mensaje claro de hoja de ruta futura (H07+).
  - Eliminación de SQL dinámico (`EXECUTE`), validación estricta de esquema y tipos, anti-spoofing con `auth.uid()` y restricción de perfiles (el rol `vendedor` no puede invocar mutaciones `DELETE`).

### Verificado
- **53 Pruebas Automatizadas Aprobadas en el Monorepo (100% PASS):**
  - 14 en `@tienda/business-logic`
  - 19 en `@tienda/database`
  - 20 en `@tienda/sync-engine`
- **Comprobación de Tipos TypeScript (`pnpm typecheck`):** 9/9 tareas exitosas sin advertencias.
- **Higiene de Seguridad:** Cero secretos, tokens o credenciales en el repositorio.
- **Integración Supabase:** Migración local preparada en `supabase/migrations/`; proyecto remoto `hixrwpiyyhrifsxgekfe` preservado intacto (modo read-only sin escrituras no autorizadas).

---

## [0.1.2] - 2026-11-15 (Hito H06.2 — Corrección Transaccional y Preparación de Supabase)

### Añadido
- **Infraestructura Local de Supabase (`supabase/`):**
  - Archivo `supabase/config.toml` vinculado al proyecto `hixrwpiyyhrifsxgekfe` (PostgreSQL 17).
  - Migración declarativa versionada `supabase/migrations/20261115000001_sync_infrastructure.sql` con tabla `sync_processed_mutations`, RLS estricto y función RPC `sync_push_mutations` con anti-spoofing (`auth.uid()`), lista blanca de entidades y deduplicación por clave de idempotencia.
- **Suite de Pruebas de Seguridad RPC (`packages/sync-engine/tests/rpc-security.test.ts`):**
  - 5 tests unitarios verificando autenticación GoTrue, rechazo de suplantación de `usuario_id`, inyección SQL y RBAC para perfiles `vendedor`.
- **Suite Automatizada de 6 Pruebas en Android (`apps/mobile/App.tsx`):**
  - Monitor en vivo y suite de 6 pruebas transaccionales ejecutables en dispositivo móvil Pixel 8.

### Corregido
- **Atomicidad Transaccional y Claves Foráneas en Expo SQLite (`packages/database`):**
  - Implementación de `AsyncTransactionMutex` y ejecución de transacciones exclusivas mediante `BEGIN IMMEDIATE;` sobre la conexión principal en `ExpoSqliteDriver`.
  - Corrección de pérdida de integridad referencial: se evita el uso de subconexiones aisladas de Expo SDK 52 que desactivaban las claves foráneas, asegurando que `PRAGMA foreign_keys = ON;` permanezca 100% activo y que errores de FK aborten y reviertan de forma atómica todas las escrituras previas.
  - Suministro obligatorio del objeto `txn` en `withExclusiveTransactionAsync` y `withTransactionAsync`.
  - Inserción coordinada atómica de entidad de negocio y encolado en `sync_outbox` bajo la misma transacción mediante `outboxRepo.enqueue(mutation, txn)`.
- **Ciclo de Vida de Conexión en Reapertura (`apps/mobile/App.tsx`):**
  - Adopción de `useRef` para `driverRef` y `outboxRepoRef`, garantizando que tras cerrar la base de datos y reabrirla, las pruebas subsiguientes consulten la conexión activa y no una referencia cerrada.

### Verificado
- **6 Pruebas Transaccionales Aprobadas en Android Pixel 8 (100% PASS):**
  - 1. Transacción confirmada: venta y detalle insertados atómicamente en `txn`.
  - 2. Reversión por excepción: rollback completo ante error simulado (0 huérfanos).
  - 3. Clave foránea inexistente: violación `SQLITE_CONSTRAINT_FOREIGNKEY` interceptada, abortando la transacción y revirtiendo escrituras.
  - 4. Inserción atómica: registro de negocio y mutación en `sync_outbox` confirmados coordinadamente.
  - 5. Reintento sin duplicación: restricción `UNIQUE(idempotency_key)` activa en SQLite local.
  - 6. Reinicio y recuperación: cierre físico de la conexión, reapertura y verificación de persistencia íntegra en disco.
- **Suites Automatizadas del Monorepo:**
  - 47 pruebas automatizadas aprobadas (14 en `business-logic`, 18 en `database`, 15 en `sync-engine`).
  - Verificación de tipos TypeScript (`pnpm typecheck`) con 9/9 tareas exitosas.

---

## [0.1.1] - 2026-11-15 (Hito H06.1 — Estabilización Android y Verificación de Supabase)

### Añadido
- **Punto de Entrada Móvil (`apps/mobile/index.js`):**
  - Registro explícito de la aplicación raíz mediante `registerRootComponent(App)` de Expo.
- **Adaptador Nativo Expo SQLite (`packages/database/src/expo-driver.ts`):**
  - Implementación de `ExpoSqliteDriver` sobre el contrato unificado `SqliteDriver` y delegación nativa hacia `expo-sqlite` (SDK 52+).
- **Recuperación de Mutaciones Huérfanas (`packages/database/src/outbox-repository.ts`):**
  - Incorporación de `resetInProgressToPending()` para restaurar automáticamente a `pending` aquellas mutaciones que quedaron en `in_progress` por caídas o reinicios inesperados.
- **Recursos Gráficos Básicos (`apps/mobile/assets`):**
  - Creación de activos PNG (`icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png`) requeridos por el empaquetador de Expo y Android.
- **Interfaz Interactiva de Verificación en Android (`apps/mobile/App.tsx`):**
  - Panel operativo que consulta pragmas reales de SQLite en el dispositivo (`journal_mode = WAL`, `synchronous = FULL`, `foreign_keys = ON`), aplica migraciones DDL, inserta mutaciones reales en Outbox, comprueba persistencia tras cierre de conexión y prueba recuperación de errores.

### Corregido
- **Sustitución de `node:crypto` por Implementación Portable (`packages/sync-engine`):**
  - Reemplazo de `node:crypto` por `js-sha256`, eliminando la incompatibilidad con el runtime Hermes de React Native y manteniendo paridad determinista exacta con vectores estándar NIST.
- **Aislamiento de Dependencia Node `better-sqlite3` (`packages/database`):**
  - Desacoplamiento de `BetterSqliteDriver` del bundle principal exportándolo bajo el subpath `./test` (`@tienda/database/test`), evitando que Metro intente resolver los módulos `fs` y `path` de Node en Android.
- **Sincronización de Dependencias Expo en Móvil (`apps/mobile`):**
  - Instalación de `expo-sqlite@~15.1.4` y actualización de `react-native` a `0.76.9` para alineación 100% con Expo SDK 52.

### Verificado
- **Arranque Real en Dispositivo Android (`Pixel_8`):**
  - Compilación e inicialización comprobada de la aplicación mediante Expo Go en emulador Android API 36.
- **Persistencia Física y Recuperación Offline:**
  - Creación y apertura comprobada de `tienda.db` en el sandbox privado de Android con WAL y `synchronous = FULL`.
  - Persistencia de mutaciones Outbox verificada tras cierre forzado de la aplicación (`am force-stop`) y reinicio.
  - Funcionamiento y encolado de mutaciones verificado en Modo Avión (sin conexión de red).
- **Inspección Read-Only de Supabase MCP (`hixrwpiyyhrifsxgekfe`):**
  - Verificación de estado `ACTIVE_HEALTHY` del proyecto, base remota PostgreSQL GA limpia (0 tablas en `public`, 0 migraciones aplicadas) y 0 avisos de seguridad en advisors.
- **Suites Automatizadas:**
  - 41 pruebas automatizadas aprobadas al 100% (Vitest) y verificación de tipos TypeScript (`tsc --noEmit`) sin errores.

---

## [0.1.0] - 2026-11-15 (Hito H06 — Inicialización del Monorepo y Base Offline-First)

### Añadido
- **Arquitectura de Monorepo con Turborepo y pnpm Workspaces (`DEC-014`):**
  - Configuración de raíz con `pnpm-workspace.yaml`, `.npmrc` (hoisted), `turbo.json` (pipelines `build`, `typecheck`, `test`), `tsconfig.base.json` (TypeScript 5.8 estricto).
  - Paquetes modulares creados: `packages/shared-types`, `packages/business-logic`, `packages/database`, `packages/sync-engine`, y aplicación móvil `apps/mobile`.
- **Tipos y Contratos Compartidos (`packages/shared-types`):**
  - Entidades de dominio base (`RolUsuario`, `EstadoVenta`, `EstadoPago`, `EstadoEntrega`, `EstadoCaja`, `MedioPago`, `TipoVenta`, `Usuario`).
  - Contratos de sincronización (`SyncOperation`, `SyncStatus`, `SyncMutation`, `SyncBatchRequest`, `SyncBatchResponse`).
  - Contratos tipados de RPCs de Supabase (`sync_push_mutations`, `conciliar_caja_offline`).
- **Lógica de Negocio y Utilidades Monetarias (`packages/business-logic`):**
  - Tipo `Centavos` con parseo determinista mediante expresiones regulares (`parseSolesToCentavos`) evitando errores de punto flotante binario IEEE 754.
  - Formateo monetario (`toDecimalString`, `formatMoneda`), aritmética protegida (`sumCentavos`, `subtractCentavos`) y límite `MAX_SAFE_CENTAVOS`.
  - Manejo funcional de errores con patrón `Result<T, E>` (`ok`, `err`).
  - Esquemas de validación en tiempo de ejecución con Zod (`SEC-INP-001`).
- **Capa de Persistencia SQLite y Cola Outbox (`packages/database`):**
  - Driver abstracto `SqliteDriver` y configuración de pragmas de conexión (`foreign_keys = ON;`, `journal_mode = WAL;`, `synchronous = FULL;`).
  - Sistema de migraciones DDL con migración inicial `001_initial_sync_schema` (tabla `sync_outbox`, índices, tabla `sync_metadata`).
  - Repositorio `OutboxRepository` para encolar mutaciones, consultar pendientes, marcar en proceso, sincronizados o fallidos con backoff.
  - Driver de pruebas `BetterSqliteDriver` sobre `better-sqlite3` para pruebas de integración con SQLite real en memoria/archivo sin necesidad de emulador.
- **Motor de Sincronización e Idempotencia (`packages/sync-engine`):**
  - Algoritmo de hash SHA-256 compuesto determinista para `idempotency_key` (`SEC-SYNC-002`).
  - Cálculo de retroceso exponencial (*exponential backoff*) con fluctuación aleatoria (*jitter*) para reintentos de red.
  - Cliente RPC de Supabase tipado (`SupabaseSyncClient`) y simulador para pruebas con fallos transitorios e interrupciones.
  - Despachador de sincronización `SyncDispatcher` con procesamiento por lotes, control de concurrencia y actualización de estados.
- **Aplicación Móvil Android en Expo (`apps/mobile`):**
  - Configuración de Expo SDK 52 con React Native 0.76.7 y TypeScript.
  - Configuración de Metro para resolución de paquetes en monorepo.
  - Pantalla base `App.tsx` con verificación en vivo de estado de infraestructura técnica, cálculo monetario y generación de clave de idempotencia.
- **Suite de Pruebas Automatizadas:**
  - 34 pruebas automatizadas aprobadas (14 en `business-logic`, 11 en `database`, 9 en `sync-engine`).

### Cambiado
- **Aprobación de Decisiones Técnicas (`docs/06-gestion/DECISIONES.md`):**
  - `DEC-012` (Outbox + Supabase RPC), `DEC-014` (Monorepo pnpm + Turborepo) y `DEC-015` (Protección híbrida base) formalmente aprobadas para el hito H06.
- **Matriz de Seguridad (`docs/04-seguridad/HARDENING.md`):**
  - Actualizados `SEC-SECR-001`, `SEC-SECR-002` y `SEC-SYNC-002` a `Verificado`.
  - Actualizados `SEC-DATA-002` y `SEC-INP-001` a `Implementado`.
- **Actualización de Planificación (`docs/05-planificacion/PLAN_DESARROLLO.md`, `docs/README.md`, `README.md`):**
  - H06 marcado como completado y H07 posicionado como próximo hito de construcción.

---

## [0.0.10] - 2026-11-15 (Hito H05 — Planificación Técnica y Estrategia de Pruebas)

### Añadido
- **Plan de Desarrollo Incremental (`docs/05-planificacion/PLAN_DESARROLLO.md`):**
  - Secuencia de construcción modular en 6 hitos (H06 a H11) priorizando la infraestructura de sincronización base antes de construir ventas y caja: H06 (Monorepo, SQLite y Sync Base - Gate técnico), H07 (Catálogo y OCR), H08 (Caja y Ventas), H09 (Proveedores y Gastos), H10 (Pruebas Integrales Offline y Conciliación) y H11 (Panel Web Administrativo).
  - Exclusión explícita de facturación electrónica y kardex continuo del alcance del MVP (conforme a `DEC-003` y `DEC-008`).
  - Matriz compacta de 23 casos de prueba automatizados cubriendo pruebas financieras en céntimos, durabilidad WAL `FULL`, atomicidad transaccional, idempotencia outbox por hash SHA-256, ventas mixtas, fiados, reservas con libro retenido, arqueos de caja, políticas RLS, cifrado local Keystore, listas CRL y resiliencia en modo avión.
  - Criterios de Aceptación (*Quality Gates*) para cierre de hitos basados en evidencia comprobable: 100% pruebas aprobadas, cero defectos P0/P1, trazabilidad explícita y verificación de seguridad.
  - Clasificación de decisiones abiertas `DEC-012` a `DEC-018` en Imprescindibles antes de H06 (`DEC-012`, `DEC-014`, `DEC-015`), Necesarias antes de módulos posteriores (`DEC-013`, `DEC-016`, `DEC-018`) y Diferibles (`DEC-017`), con recomendaciones técnicas sin confirmación arbitraria.

### Corregido
- **Conversión Monetaria Determinista (`docs/03-estandares/ESTANDAR_PROGRAMACION.md`):**
  - Sustitución de `Math.round(soles * 100)` por la función `parseSolesToCentavos` basada en descomposición de cadenas y aritmética entera exacta sin error de coma flotante IEEE 754.
- **Seguridad en Replicación de Datos Bancarios (`docs/04-seguridad/HARDENING.md` y `DEC-015` en `DECISIONES.md`):**
  - Definición del modelo multi-dispositivo sin intercambio de claves privadas: protección central con RLS y Vault en Supabase, transporte TLS 1.3 y cifrado local en SQLite con clave simétrica AES-256-GCM independiente generada en el Android Keystore de cada terminal.
- **Diferenciación entre Reservas y Fiados (`REGLAS_NEGOCIO.md`, `MODELO_DATOS.md` y `DICCIONARIO_DATOS.md`):**
  - Reservas con anticipo (`estado_entrega = 'retenido'`): mercadería custodiada en tienda, riesgo nulo, operable por vendedor sin PIN de supervisor, exigiendo nombre y teléfono de contacto.
  - Fiados con entrega física (`estado_entrega = 'entregado_saldo_pendiente'`): mercadería retirada con saldo, riesgo crediticio total, autorización obligatoria con PIN de supervisor y documento oficial de identidad (DNI/CE).
  - Refinamiento de restricción `CHECK` a nivel de tabla en `ventas`.

### Cambiado
- **Actualización de Índices y Estado General:**
  - `docs/README.md` y `README.md`: Cierre formal de la Fase 1 de diseño (H00 a H05) y posicionamiento del Hito H06 como próximo paso técnico.

---

## [0.0.9] - 2026-11-15 (Hito H04 — Estándares de Programación y Hardening de Seguridad)

### Añadido
- **Estándar Exhaustivo de Programación (`docs/03-estandares/ESTANDAR_PROGRAMACION.md`):**
  - Reglas estrictas de TypeScript (`strict`, `noImplicitAny`, prohibición de `any`, tagged unions discriminadas y tipado explícito de retornos).
  - Modelo formal de cantidades monetarias en memoria y código operado como enteros en céntimos (`Centavos`) con funciones de conversión puras para evitar errores de redondeo de punto flotante binario IEEE 754.
  - Arquitectura modular orientada a características (*Vertical Slices / Feature-Based*) en el monorepo (`features/[nombre]/{components, hooks, services, repositories, schemas, types}`).
  - Convenciones para React Native y Expo: separación estricta de presentación y dominio, virtualización con `@shopify/flash-list`, y ergonomía táctil accesible (mínimo 48x48 dp).
  - Persistencia segura y patrón repositorio: consultas parametrizadas en SQLite (`expo-sqlite`), transacciones atómicas explícitas con `withTransactionAsync` o `BEGIN IMMEDIATE`, y cliente Supabase fuertemente tipado con exclusión absoluta de `service_role_key`.
  - Validación en fronteras mediante esquemas Zod y patrón funcional `Result<T, E>` para manejo predecible de errores de negocio.
  - Pirámide de pruebas automatizadas: unitarias con Vitest (mínimo 85% en dominio financiero), integración con React Native Testing Library + SQLite en memoria, y E2E con Maestro en Android.
- **Línea Base de Hardening y Matriz de Seguridad (`docs/04-seguridad/HARDENING.md`):**
  - Reformateo estricto de la matriz de controles de seguridad en formato `ID | Control | Riesgo | Verificación | Estado`, declarando 21 controles formalmente especificados en estado `Pendiente`.
  - Especificación exhaustiva en 9 dominios: GoTrue JWT, Android Keystore, RLS en PostgreSQL, RBAC, PIN de autorización para fiados, autorización offline con CRL y HMAC, cifrado por campos con AES-256-GCM, sandboxing, buckets privados, URLs firmadas, TLS 1.3, Secreto Cero, auditoría inmutable, idempotencia outbox y validación Zod.
- **Análisis de Claves y Cifrado en `DEC-015` (`docs/06-gestion/DECISIONES.md`):**
  - Comparación detallada entre SQLCipher y Cifrado Híbrido por Campos (AES-256-GCM + Android Keystore), analizando ciclo de vida de claves: generación por hardware, rotación periódica/por cambio de PIN, y mitigación de riesgo de corrupción total mediante recuperación por sincronización remota desde Supabase.

### Corregido
- **Ajustes de Modelo Relacional y Diccionario de Datos (`MODELO_DATOS.md` y `DICCIONARIO_DATOS.md`):**
  - Sustitución de `NUMERIC` en SQLite por `INTEGER` en céntimos para el 100% de los campos monetarios, definiendo fórmula de conversión exacta con PostgreSQL `NUMERIC(12,2)`.
  - Incorporación de campos `whatsapp` y `especialidades` en la tabla `proveedores`.
  - Incorporación de restricción `CHECK` de identificación mínima obligatoria (nombre >= 3 chars, documento >= 6 chars) para clientes en ventas con entrega y saldo fiado.
  - Solución al correlativo multi-terminal offline mediante asignación de series por dispositivo (`serie`, ej. `'NV01'`, `'NV02'`) con correlativo monotónico local y restricción `UNIQUE(serie, correlativo)`.
  - Protección transaccional contra sobrepagos concurrentes mediante bloqueo `FOR UPDATE` en Supabase y `BEGIN IMMEDIATE` en SQLite.
  - Corrección de enlaces absolutos locales `file:///` en `DICCIONARIO_DATOS.md` hacia enlaces relativos válidos en Markdown.

### Cambiado
- **Actualización de Planificación y Estado:**
  - `docs/05-planificacion/PLAN_DESARROLLO.md`: Registro de H04 como completado y activación formal de H05 (Planificación Técnica, Pruebas y Criterios de Aceptación).
  - `docs/README.md` y `README.md`: Sincronización del estado de avance hacia la versión `0.0.9`.

---

## [0.0.8] - 2026-11-15 (Hito H03 — Diseño del Modelo y Diccionario de Datos)

### Añadido
- **Consolidación del Modelo Relacional (`docs/02-arquitectura/MODELO_DATOS.md`):**
  - Estructuración del modelo en 3 dominios complementarios con diagramas ERD Mermaid legibles: Catálogo y Proveedores, Ventas y Tesorería, y Sincronización y Auditoría.
  - Diseño de 26 entidades normalizadas con claves primarias UUID v4 descentralizadas, marcas de tiempo UTC monotónicas y soporte de trazabilidad multi-dispositivo con `dispositivo_id`.
  - Especificación de soluciones de datos para escenarios críticos: ventas rápidas sin detalles inmediatos, pedidos de libros no catalogados con foto y texto libre, pagos parciales con mercadería retenida o entregada con saldo (fiado), operaciones financieras inmutables append-only y conciliación asíncrona de cierres de caja provisionales.
  - Clasificación explícita de persistencia: 22 tablas replicadas (PostgreSQL + SQLite), 3 tablas exclusivas de SQLite móvil (`sync_outbox`, `usuarios_sesion_local`, `credenciales_revocadas_local`) y 2 tablas exclusivas de PostgreSQL central (`sync_processed_mutations`, `auditoria_financiera`).
- **Diccionario de Datos Exhaustivo (`docs/03-estandares/DICCIONARIO_DATOS.md`):**
  - Catálogo completo de las 26 entidades del sistema documentando nombre, propósito, tipos equivalentes PostgreSQL/SQLite, nulabilidad, restricciones `CHECK`, unicidad, claves foráneas e índices.
  - Convenciones unificadas para identificadores UUID v4, importes monetarios exactos (`NUMERIC(12,2)` / dos decimales redondeados), marcas de tiempo UTC (`TIMESTAMPTZ` / ISO-8601), fechas comerciales locales (`DATE` / `YYYY-MM-DD`) y estados enums validados.
  - Matriz de integridad y restricciones financieras anti-LWW que previene pagos duplicados, importes negativos, ventas sin trazabilidad, abonos que excedan la deuda y descuadres contables.

### Cambiado
- **Actualización de Gobernanza y Planificación:**
  - `docs/05-planificacion/PLAN_DESARROLLO.md`: Registro de H03 como completado y activación formal de H04 (Estándares de Programación y Hardening de Seguridad).
  - `docs/README.md` y `README.md`: Actualización del estado de avance hacia el hito H04.

---

## [0.0.7] - 2026-11-15 (Hito H02.1 — Correcciones Críticas de Arquitectura)

### Añadido
- **Controles de Seguridad Reforzados (`docs/04-seguridad/HARDENING.md`):**
  - Incorporación de `SEC-AUTHZ-004` (Autorización offline de operaciones sensibles con caducidad de credenciales en caché, lista de revocación local y auditoría criptográfica HMAC).
  - Incorporación de `SEC-SYNC-003` (Mínimo privilegio en funciones RPC de Supabase, exigiendo `SECURITY INVOKER` o `SECURITY DEFINER` con `search_path`, validación de `auth.uid()` y roles).
- **Registro de Nuevas Propuestas Técnicas (`docs/06-gestion/DECISIONES.md`):**
  - Registro formal de `DEC-017` (Período de gracia de 7 días para caducidad de sesiones offline) y `DEC-018` (Política de exclusividad de sesión de caja por dispositivo físico), manteniéndolas en estado `Propuesto` pendiente de decisión.

### Corregido
- **Durabilidad y Persistencia en SQLite (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Análisis comparativo de `PRAGMA synchronous = NORMAL` frente a `FULL` en modo WAL. Establecimiento de política estricta de `synchronous = FULL` para transacciones financieras críticas (ventas, cobros, caja) garantizando persistencia física (*fsync*) ante apagados súbitos o caídas del SO.
- **Seguridad en Funciones RPC de Supabase (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Mitigación del riesgo de bypass de RLS en funciones RPC, priorizando `SECURITY INVOKER` y restringiendo privilegios de ejecución en PostgreSQL.
- **Requerimientos Nativos y Disponibilidad Offline de OCR (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Documentación obligatoria de Expo Development Builds / Prebuild para Google ML Kit y configuración de empaquetado del modelo en el manifiesto nativo para disponibilidad 100% offline tras la instalación.
- **Sustitución de Garantías por Objetivos de Rendimiento (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Reemplazo de afirmaciones categóricas de latencia por metas cuantitativas formalmente sujetas a pruebas empíricas de benchmark en hardware Android representativo.
- **Reordenamiento Estratégico del Plan de Desarrollo (`docs/05-planificacion/PLAN_DESARROLLO.md`):**
  - Reestructuración de la fase H06 para construir la infraestructura base de sincronización, outbox e idempotencia antes del desarrollo de ventas y caja (H08), eliminando retrabajos arquitectónicos.
- **Registro Explícito de Riesgos Técnicos (`docs/06-gestion/DECISIONES.md`):**
  - Documentación de riesgos técnicos y medidas de mitigación para las opciones recomendadas en `DEC-012`, `DEC-013`, `DEC-014` y `DEC-015`.

---

## [0.0.6] - 2026-11-15 (Hito H02 — Arquitectura del Sistema y Estrategia Offline-First)

### Añadido
- **Consolidación del Documento de Arquitectura (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Diagrama general de arquitectura en Mermaid con capas del cliente móvil Android, canal seguro TLS 1.3, backend Supabase y panel web administrativo.
  - Especificación formal de la organización del Monorepo con `pnpm workspaces` y `Turborepo` (`apps/mobile`, `apps/web`, `packages/shared-types`, `packages/business-logic`, `packages/database`, `packages/sync-engine`).
  - Arquitectura móvil por módulos funcionales (*feature-based*) con separación estricta entre presentación (UI), hooks, servicios de dominio y repositorios de persistencia.
  - Integración técnica detallada con Supabase: GoTrue Auth (sesión persistida en Android Keystore con `expo-secure-store`, expiración offline tras 7 días), PostgreSQL con RLS y RPCs transaccionales (`rpc_push_mutations`, `rpc_pull_deltas`), y buckets de Supabase Storage para archivos multimedia.
  - Pipeline de medios y captura asistida: almacenamiento local inmediato en sandbox, inferencia OCR on-device con Google ML Kit (`@react-native-ml-kit/text-recognition`) en <300ms, y subida asíncrona desacoplada (`PhotoUploadWorker`).
  - Estrategia integral de sincronización offline con patrón Outbox, idempotencia basada en UUID v4 y claves hash (`idempotency_key`), backoff exponencial con jitter y modelo de Libro Mayor Append-Only (aditivo e inmutable) que veta *Last-Write-Wins* en ventas, cobros y caja.
  - Protocolo de cierres de caja provisionales offline y conciliación contable en servidor (`DEC-007`, `RN-CAJ-004`).
  - Diagramas de secuencia esenciales: ciclo de sincronización Outbox e idempotencia, y conciliación de cierres de caja provisorios.
  - Matriz de evaluación tecnológica y recomendaciones justificadas para `DEC-012`, `DEC-013`, `DEC-014` y `DEC-015`.
- **Registro de Decisiones Arquitectónicas (`docs/06-gestion/DECISIONES.md`):**
  - Actualización de `DEC-012` (Recomendación: Outbox sobre `expo-sqlite`), `DEC-013` (Recomendación: Solución Híbrida con Google ML Kit on-device), `DEC-014` (Recomendación: pnpm + Turborepo) y `DEC-015` (Recomendación: Cifrado Híbrido con Keystore y campos sensibles), manteniéndolas en estado `Propuesto (Recomendado en H02)` sin confirmación arbitraria.

### Cambiado
- **Actualización de Gobernanza y Planificación:**
  - `docs/05-planificacion/PLAN_DESARROLLO.md`: Registro de H02 como completado y activación de H03 (Modelo y Diccionario de Datos).
  - `docs/README.md` y `README.md`: Actualización del estado de avance hacia el hito H03.

---

## [0.0.5] - 2026-11-15 (Hito H01.1 — Simplificación y Normalización Documental)

### Añadido
- **Estándar Permanente de Documentación (`docs/03-estandares/ESTANDAR_DOCUMENTACION.md`):**
  - Directrices obligatorias de brevedad, alta densidad informativa, tablas compactas, eliminación de narrativa ornamental, unicidad de fuente de verdad y estabilidad de identificadores.
- **Mandato en Directrices para Agentes (`AGENTS.md`):**
  - Incorporación de la Sección 10 que establece la obligatoriedad del cumplimiento de `ESTANDAR_DOCUMENTACION.md` para todos los agentes y desarrolladores en futuros hitos.

### Cambiado
- **Normalización y Síntesis del SRS (`docs/01-requerimientos/SRS.md`):**
  - Reducción de ~1,022 a ~442 líneas conservando el 100% del alcance funcional, 45 RFs en tablas modulares compactas, 14 CUs estructurados con flujos y criterios de aceptación, 4 diagramas Mermaid clave y matriz de trazabilidad completa.
- **Normalización y Síntesis de Reglas de Negocio (`docs/01-requerimientos/REGLAS_NEGOCIO.md`):**
  - Reducción de ~338 a ~135 líneas mediante catálogo tabular compacto, matrices de compatibilidad de estados y matriz RBAC por roles.
- **Subsanación de Inconsistencias Numéricas de H01:**
  - Reglas de negocio: Declaración unívoca y enumeración exacta de 27 reglas (26 confirmadas + 1 propuesta pendiente: `RN-VTA-004`).
  - Casos de uso: Declaración, desarrollo formal y trazabilidad 1 a 1 de exactamente 14 casos de uso (`CU-AUT-01`, `CU-CAT-01..02`, `CU-VTA-01..02`, `CU-PAG-01..02`, `CU-CAJ-01..03`, `CU-PED-01..02`, `CU-PRV-01`, `CU-GAS-01`).
- **Tratamiento de Políticas No Confirmadas:**
  - El umbral de descuento del 15% para el rol Vendedor se clasifica y documenta explícitamente como propuesta pendiente en `RN-VTA-004` y `DEC-016`, sin imponerse como regla obligatoria en el MVP.
- **Actualización de Gobernanza y Planificación:**
  - Actualización de `PLAN_DESARROLLO.md` (inclusión de H01.1, eliminación de bloque duplicado de H02), `docs/README.md` y `README.md`.

---

## [0.0.4] - 2026-11-15 (Hito H01 — Especificación Detallada del SRS y Reglas de Negocio)

### Añadido
- **Refinamiento Integral del SRS (`docs/01-requerimientos/SRS.md`):**
  - Especificación exhaustiva de 11 módulos funcionales y 45 requerimientos funcionales (`RF-AUT`, `RF-CAT`, `RF-OCR`, `RF-VTA`, `RF-PAG`, `RF-CAJ`, `RF-GAS`, `RF-PRV`, `RF-PED`, `RF-REP`, `RF-OFF`) estructurados con identificador, descripción verificable, actor, prioridad MVP/Futura, precondiciones, reglas vinculadas, criterios de aceptación y excepciones.
  - Especificación formal de 14 casos de uso (`CU-AUT-01`, `CU-CAT-01..02`, `CU-VTA-01..02`, `CU-PAG-01..02`, `CU-CAJ-01..03`, `CU-PED-01..02`, `CU-PRV-01`, `CU-GAS-01`) con flujos principales, alternativos, excepciones y criterios de aceptación Gherkin.
  - 4 diagramas Mermaid renderizables: flujo de ventas normales vs. rápidas, ciclo de sesiones de caja con cierres offline y conciliación, pedidos de faltantes con recepciones parciales, y mapa de actores y módulos.
  - Matriz de trazabilidad integral (`RF` → `RN` → `CU` → `Criterio` → `Prioridad`).
  - Registro de observaciones y directrices de modelado relacional para el hito H03.
- **Ampliación y Consolidación de Reglas de Negocio (`docs/01-requerimientos/REGLAS_NEGOCIO.md`):**
  - Catálogo formal ampliado a 26 reglas de negocio (`RN-ALC-001` a `RN-OFF-001`), incorporando reglas para registro sin ISBN y prevención de duplicados (`RN-CAT-004`), categorización temática (`RN-CAT-005`), protección de datos bancarios de proveedores (`RN-PRV-002`), pedidos de no catalogados por foto/texto libre (`RN-PED-003`), anticipos con mercadería retenida (`RN-PAG-004`), arqueo físico desglosado por medio de pago (`RN-CAJ-003`), y restricciones offline (`RN-OFF-001`).
  - Matriz de compatibilidad estricta entre estados de venta, pago y entrega física para evitar estados incompatibles.
  - Matriz de control de acceso basado en roles (RBAC) detallada por operación.
- **Registro de Decisiones Arquitectónicas (`docs/06-gestion/DECISIONES.md`):**
  - Incorporación de `DEC-016` (Propuesta de política de descuentos máximos delegados al rol Vendedor).

---

## [0.0.3] - 2026-11-15 (Hito H00.2 — Configuración Git, Publicación Inicial y Política de Versionado)

### Añadido
- **Control de Versiones y Configuración Remota:**
  - Inicialización del repositorio local Git en la rama `master`.
  - Vinculación con el repositorio remoto oficial en GitHub: `https://github.com/JMedina255/Proyecto_tienda.git`.
  - Creación del archivo `.gitignore` optimizado para monorepo (Expo/Android, Web, TypeScript, Supabase y protección de secretos).
- **Política Permanente de Versionado en `AGENTS.md`:**
  - Incorporación de la Sección 9 con 9 directrices obligatorias: commit identificable por hito importante, push mandatorio a remoto, formato Conventional Commits, prohibición de secretos, veto a `push --force` y merges destructivos, inspección con `git diff`, evolución atómica código-documentación y política de ramas.
- **Entregables Git en Plan de Desarrollo:**
  - Inclusión formal del entregable Git (commit + push a `origin/master`) por cada hito en `docs/05-planificacion/PLAN_DESARROLLO.md`.
- **Publicación Inicial:**
  - Publicación de la línea base documental consolidada (H00 y H00.1) en el repositorio remoto oficial.

---

## [0.0.2] - 2026-11-15 (Hito H00.1 — Auditoría y Consolidación Documental)

### Añadido
- **Consolidación de Reglas de Negocio:**
  - Tabla índice formal en `docs/01-requerimientos/REGLAS_NEGOCIO.md` que declara y enumera unívocamente las 18 reglas de negocio consolidadas (`RN-ALC-001` a `RN-FAC-001`) con sus dominios y decisiones asociadas.
- **Realineación del Plan de Desarrollo:**
  - Nueva secuencia formal de hitos en `docs/05-planificacion/PLAN_DESARROLLO.md`: H00 (Inicialización), H00.1 (Auditoría activa), H01 (SRS y Reglas detalladas), H02 (Arquitectura y Sync offline), H03 (Modelo y Diccionario de datos), H04 (Estándares y Hardening), H05 (Planificación técnica y criterios), H06 (Monorepo e inicio de implementación sujeto a aprobación), seguido de las fases de construcción (H07+).
- **Distinción Formal de Decisiones Arquitectónicas:**
  - En `docs/06-gestion/DECISIONES.md`, explicitación de hitos de resolución técnica para las decisiones pendientes y propuestas (`DEC-012`, `DEC-013`, `DEC-014` para resolver en H02; `DEC-015` para resolver en H04).

### Corregido
- **Inconsistencia Cuantitativa en Reglas de Negocio:**
  - Subsanada la discrepancia donde el informe previo mencionaba 15 reglas pero enumeraba 18. Se confirma, declara y documenta de forma unívoca un total de 18 reglas.
- **Verificación de Ubicación de Plan de Desarrollo:**
  - Confirmación de que `PLAN_DESARROLLO.md` existe única y exclusivamente en `docs/05-planificacion/PLAN_DESARROLLO.md`.
- **Alineación de Fases en Hardening:**
  - Ajuste en `docs/04-seguridad/HARDENING.md` para distinguir la fase de especificación (H04) de la fase de implementación técnica (H06+).
- **Actualización de Índices de Estado:**
  - Sincronización del estado actual en `README.md` y `docs/README.md` indicando H00.1 como hito activo y H01 como próximo hito.

---

## [0.0.1] - 2026-11-15 (Hito H00)

### Añadido
- **Fundación y Gobernanza Documental:**
  - `README.md` principal del proyecto con visión del negocio, objetivos, alcance, usuarios, tecnologías y arquitectura general.
  - `AGENTS.md` con instrucciones permanentes para agentes de desarrollo y LLMs: trazabilidad estricta, inmutabilidad de decisiones confirmadas, sincronización documental y política de secreto cero.
  - `docs/README.md` como índice maestro de documentos, estado de elaboración y protocolo de mantenimiento.
- **Requerimientos y Políticas de Negocio:**
  - `docs/01-requerimientos/SRS.md`: Especificación de Requerimientos de Software (IEEE 830 / ISO 29148) preliminar, con actores, requerimientos funcionales (`RF-xxx`), no funcionales (`RNF-xxx`) y casos de uso (`CU-xxx`) con criterios de aceptación en Gherkin.
  - `docs/01-requerimientos/REGLAS_NEGOCIO.md`: Catálogo formal de reglas de negocio (`RN-xxx`), restricciones por rol y máquinas de estado para Venta, Pago, Entrega, Caja y Pedidos a Proveedores con diagramas Mermaid.
- **Arquitectura y Modelo de Datos:**
  - `docs/02-arquitectura/ARQUITECTURA.md`: Diseño arquitectónico *Offline-First*, propuesta de Monorepo (`apps/mobile`, `apps/web`, `packages/shared-types`, `packages/sync-engine`), motor de replicación con patrón Outbox, pipeline de procesamiento OCR y diseño extensible para facturación electrónica futura.
  - `docs/02-arquitectura/MODELO_DATOS.md`: Esquema entidad-relación preliminar (Mermaid ERD), catálogo de entidades candidatas y principios de diseño relacional (UUID v4 descentralizado, auditoría UTC).
- **Estándares Técnicos y Diccionario:**
  - `docs/03-estandares/ESTANDAR_PROGRAMACION.md`: Guías y convenciones para TypeScript estricto, React Native/Expo, React, estructura modular, nomenclatura, testing y manejo de errores resiliente.
  - `docs/03-estandares/DICCIONARIO_DATOS.md`: Metodología estándar de documentación de campos, equivalencias de tipos entre PostgreSQL y SQLite, restricciones y catálogo inicial de tablas base.
- **Seguridad y Planificación:**
  - `docs/04-seguridad/HARDENING.md`: Línea base de seguridad y matriz de controles (`SEC-xxx`) clasificados estrictamente por estado (`Pendiente` para H00, sin declaraciones falsas de implementación).
  - `docs/05-planificacion/PLAN_DESARROLLO.md`: Plan de desarrollo estructurado en 10 hitos (H00 a H09), dependencias, entregables verificables y criterios de aceptación.
  - `docs/06-gestion/DECISIONES.md`: Registro de Decisiones de Arquitectura (ADR) con 11 decisiones confirmadas (`DEC-001` a `DEC-011`) y 4 propuestas/pendientes (`DEC-012` a `DEC-015`).

### Cambiado
- Ninguno (versión inicial del repositorio).

### Deprecado
- Ninguno.

### Eliminado
- Ninguno.

### Corregido
- Ninguno.

### Seguridad
- Establecimiento de la política de secreto cero en `AGENTS.md` y `HARDENING.md`.
- Verificación de ausencia de credenciales, tokens o datos sensibles en todos los artefactos documentales.
