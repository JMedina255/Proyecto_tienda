-- =============================================================================
-- Migración Inicial: Infraestructura Central de Sincronización e Idempotencia
-- Trazabilidad: ARQUITECTURA.md §6, MODELO_DATOS.md §3.5, HARDENING.md §2.8
-- DEC-009, DEC-012, SEC-SYNC-001, SEC-SYNC-002, SEC-SYNC-003, SEC-AUTHZ-001
-- =============================================================================

-- 1. Tabla de deduplicación global y auditoría de mutaciones procesadas
CREATE TABLE IF NOT EXISTS public.sync_processed_mutations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL,
    dispositivo_id TEXT NOT NULL,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'already_applied', 'rejected')),
    payload JSONB,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    client_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Índices de alta velocidad para deduplicación y consultas multi-terminal
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_processed_idempotency
    ON public.sync_processed_mutations (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_sync_processed_device_time
    ON public.sync_processed_mutations (dispositivo_id, server_timestamp);

CREATE INDEX IF NOT EXISTS idx_sync_processed_entity
    ON public.sync_processed_mutations (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_sync_processed_user
    ON public.sync_processed_mutations (usuario_id);

-- 2. Tabla real de prueba para sincronización en H06
-- Permite verificar que las operaciones aplican cambios reales en tablas de dominio
CREATE TABLE IF NOT EXISTS public.sync_test_records (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3. Habilitación obligatoria de Row Level Security (RLS)
ALTER TABLE public.sync_processed_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_test_records ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura en sync_processed_mutations
DROP POLICY IF EXISTS "sync_processed_select_policy" ON public.sync_processed_mutations;
CREATE POLICY "sync_processed_select_policy" ON public.sync_processed_mutations
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = usuario_id
        OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'vendedor') IN ('dueno', 'administrador')
    );

-- Bloqueo de escrituras directas por clientes REST (solo la función RPC puede insertar)
DROP POLICY IF EXISTS "no_direct_client_insert" ON public.sync_processed_mutations;
CREATE POLICY "no_direct_client_insert" ON public.sync_processed_mutations
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "no_direct_client_update" ON public.sync_processed_mutations;
CREATE POLICY "no_direct_client_update" ON public.sync_processed_mutations
    FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "no_direct_client_delete" ON public.sync_processed_mutations;
CREATE POLICY "no_direct_client_delete" ON public.sync_processed_mutations
    FOR DELETE
    TO authenticated
    USING (false);

-- Políticas en sync_test_records
DROP POLICY IF EXISTS "sync_test_records_select_policy" ON public.sync_test_records;
CREATE POLICY "sync_test_records_select_policy" ON public.sync_test_records
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "sync_test_records_direct_block" ON public.sync_test_records;
CREATE POLICY "sync_test_records_direct_block" ON public.sync_test_records
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 4. Función RPC transaccional segura para recepción, aplicación y deduplicación de mutaciones
-- Reglas críticas:
-- - Cero SQL dinámico (no evalúa código arbitrario ni concatena identificadores).
-- - Soporta argumento p_batch como objeto SyncBatchRequest {"dispositivoId", "appVersion", "mutations"} o array.
-- - La identidad del usuario (usuario_id) se extrae del token GoTrue (auth.uid()), NUNCA del cliente.
-- - El rol se valida desde auth.jwt() -> 'app_metadata' ->> 'role'.
-- - Aplica realmente la operación de dominio en una sola transacción o rechaza si no está implementada.
-- - Resuelve concurrencia mediante INSERT ON CONFLICT DO NOTHING a nivel de índice atómico.
CREATE OR REPLACE FUNCTION public.sync_push_mutations(p_batch JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_mutations JSONB;
    v_batch_device_id TEXT := 'desconocido';
    v_mutation JSONB;
    v_idempotency_key TEXT;
    v_dispositivo_id TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_operation TEXT;
    v_payload JSONB;
    v_client_timestamp TIMESTAMPTZ;
    v_processed_count INT := 0;
    v_already_applied_count INT := 0;
    v_failed_count INT := 0;
    v_results JSONB := '[]'::JSONB;
    v_inserted_id UUID;
    v_item_result JSONB;
BEGIN
    -- Verificación mandatoria de sesión autenticada
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado: se requiere sesión activa de GoTrue'
            USING ERRCODE = '28000';
    END IF;

    -- Obtención segura del rol desde los claims del servidor
    v_user_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'vendedor');

    -- Validación y normalización del argumento de entrada (objeto SyncBatchRequest o arreglo de mutaciones)
    IF p_batch IS NULL THEN
        RAISE EXCEPTION 'El argumento p_batch no puede ser nulo'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_batch) = 'array' THEN
        v_mutations := p_batch;
    ELSIF jsonb_typeof(p_batch) = 'object' THEN
        v_batch_device_id := COALESCE(p_batch ->> 'dispositivoId', 'desconocido');
        v_mutations := p_batch -> 'mutations';
        IF v_mutations IS NULL OR jsonb_typeof(v_mutations) <> 'array' THEN
            RAISE EXCEPTION 'El campo mutations de p_batch debe ser un arreglo JSONB'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        RAISE EXCEPTION 'El argumento p_batch debe ser un objeto o arreglo JSONB'
            USING ERRCODE = '22023';
    END IF;

    -- Procesamiento de cada mutación en el lote
    FOR v_mutation IN SELECT * FROM jsonb_array_elements(v_mutations)
    LOOP
        v_idempotency_key := v_mutation ->> 'idempotencyKey';
        v_dispositivo_id := COALESCE(v_mutation ->> 'dispositivoId', v_batch_device_id);
        v_entity_type := v_mutation ->> 'entityType';
        v_entity_id := v_mutation ->> 'entityId';
        v_operation := v_mutation ->> 'operation';
        v_payload := v_mutation -> 'payload';
        v_client_timestamp := (v_mutation ->> 'createdAt')::TIMESTAMPTZ;

        -- 1. Validación de campos obligatorios
        IF v_idempotency_key IS NULL OR length(v_idempotency_key) <> 64
           OR v_entity_type IS NULL OR v_entity_id IS NULL
           OR v_operation IS NULL OR v_operation NOT IN ('INSERT', 'UPDATE', 'DELETE')
        THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := jsonb_build_object(
                'idempotencyKey', COALESCE(v_idempotency_key, 'unknown'),
                'entityType', COALESCE(v_entity_type, 'unknown'),
                'entityId', COALESCE(v_entity_id, 'unknown'),
                'status', 'failed',
                'success', false,
                'error', 'Parámetros de mutación inválidos o incompletos',
                'serverTimestamp', clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        END IF;

        -- 2. Control de permisos según el rol del usuario autenticado (RBAC)
        IF v_user_role = 'vendedor' AND v_operation = 'DELETE' THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'rejected',
                'success', false,
                'error', 'El rol vendedor no tiene privilegios para ejecutar operaciones de borrado',
                'serverTimestamp', clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        END IF;

        -- 3. Verificación de entidades implementadas vs no implementadas
        -- En H06 sólo sync_test cuenta con persistencia de dominio implementada
        IF v_entity_type IN ('ventas', 'pagos_venta', 'movimientos_caja', 'libros', 'ediciones_libro') THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'rejected',
                'success', false,
                'error', 'Entidad aún no implementada en el backend (prevista para H07+): ' || v_entity_type,
                'serverTimestamp', clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        ELSIF v_entity_type <> 'sync_test' THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'rejected',
                'success', false,
                'error', 'Entidad no reconocida en la lista blanca del servidor: ' || v_entity_type,
                'serverTimestamp', clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        END IF;

        -- 4. Deduplicación e Idempotencia atómica contra concurrencia
        -- Intento de inserción con resolución de conflicto sin excepción
        INSERT INTO public.sync_processed_mutations (
            idempotency_key,
            dispositivo_id,
            usuario_id,
            entity_type,
            entity_id,
            operation,
            status,
            payload,
            client_timestamp
        ) VALUES (
            v_idempotency_key,
            v_dispositivo_id,
            v_user_id,
            v_entity_type,
            v_entity_id,
            v_operation,
            'processed',
            v_payload,
            COALESCE(v_client_timestamp, clock_timestamp())
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NULL THEN
            -- Conflicto: la mutación ya fue procesada anteriormente o por una solicitud concurrente
            v_already_applied_count := v_already_applied_count + 1;
            v_item_result := jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'already_applied',
                'success', true,
                'serverTimestamp', clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        END IF;

        -- 5. Aplicación real de la operación de dominio para entidades implementadas ('sync_test')
        IF v_operation = 'INSERT' THEN
            INSERT INTO public.sync_test_records (
                id, client_id, payload, created_by, created_at, updated_at
            ) VALUES (
                v_entity_id, v_dispositivo_id, COALESCE(v_payload, '{}'::JSONB), v_user_id,
                COALESCE(v_client_timestamp, clock_timestamp()), clock_timestamp()
            )
            ON CONFLICT (id) DO UPDATE SET
                payload = EXCLUDED.payload,
                updated_at = clock_timestamp();
        ELSIF v_operation = 'UPDATE' THEN
            UPDATE public.sync_test_records
            SET payload = COALESCE(v_payload, '{}'::JSONB),
                updated_at = clock_timestamp()
            WHERE id = v_entity_id;
        ELSIF v_operation = 'DELETE' THEN
            DELETE FROM public.sync_test_records
            WHERE id = v_entity_id;
        END IF;

        v_processed_count := v_processed_count + 1;
        v_item_result := jsonb_build_object(
            'idempotencyKey', v_idempotency_key,
            'entityType', v_entity_type,
            'entityId', v_entity_id,
            'status', 'processed',
            'success', true,
            'serverTimestamp', clock_timestamp()
        );
        v_results := v_results || v_item_result;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'processedCount', v_processed_count,
        'alreadyAppliedCount', v_already_applied_count,
        'failedCount', v_failed_count,
        'results', v_results
    );
END;
$$;

-- Revocación de acceso anónimo/público y asignación estricta al rol autenticado
REVOKE ALL ON FUNCTION public.sync_push_mutations(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_push_mutations(JSONB) TO authenticated;
