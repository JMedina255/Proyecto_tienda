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
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'already_applied', 'rejected', 'processing')),
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
ALTER TABLE public.sync_processed_mutations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sync_test_records FORCE ROW LEVEL SECURITY;

-- Políticas de lectura en sync_processed_mutations
DROP POLICY IF EXISTS "sync_processed_select_policy" ON public.sync_processed_mutations;
CREATE POLICY "sync_processed_select_policy" ON public.sync_processed_mutations
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = usuario_id
        OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'vendedor') IN ('dueno', 'administrador')
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

-- Políticas en sync_test_records: Restricción estricta de lectura para impedir acceso a datos ajenos
DROP POLICY IF EXISTS "sync_test_records_select_policy" ON public.sync_test_records;
CREATE POLICY "sync_test_records_select_policy" ON public.sync_test_records
    FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), 'vendedor') IN ('dueno', 'administrador')
    );

-- Bloqueo de mutaciones directas por clientes REST (solo la función RPC puede mutar registros)
DROP POLICY IF EXISTS "sync_test_records_direct_block" ON public.sync_test_records;
CREATE POLICY "sync_test_records_direct_block" ON public.sync_test_records
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 4. Función RPC transaccional segura para recepción, aplicación y deduplicación de mutaciones
-- Reglas críticas:
-- - search_path = '' para inmunidad total frente a secuestro de esquemas (CWE-426).
-- - Referencias explícitas pg_catalog., public., auth.
-- - Soporta argumento p_batch como objeto SyncBatchRequest {"dispositivoId", "appVersion", "mutations"} o array.
-- - Límite de lote estricto (1 a 100 mutaciones).
-- - La identidad del usuario (usuario_id) se extrae del token GoTrue (auth.uid()), NUNCA del cliente.
-- - El rol se valida desde auth.jwt() -> 'app_metadata' ->> 'role'.
-- - Comprobación de propiedad y permisos antes de mutar registros de dominio.
-- - Verificación de filas afectadas (ROW_COUNT) en UPDATE y DELETE antes de reportar éxito.
-- - Idempotencia reforzada: rechaza claves duplicadas reutilizadas con parámetros diferentes.
-- - Resuelve concurrencia mediante INSERT ON CONFLICT DO NOTHING a nivel de índice atómico.
CREATE OR REPLACE FUNCTION public.sync_push_mutations(p_batch pg_catalog.jsonb)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id pg_catalog.uuid;
    v_user_role pg_catalog.text;
    v_mutations pg_catalog.jsonb;
    v_batch_length pg_catalog.int4;
    v_batch_device_id pg_catalog.text := 'desconocido';
    v_mutation pg_catalog.jsonb;
    v_idempotency_key pg_catalog.text;
    v_dispositivo_id pg_catalog.text;
    v_entity_type pg_catalog.text;
    v_entity_id pg_catalog.text;
    v_operation pg_catalog.text;
    v_payload pg_catalog.jsonb;
    v_client_timestamp pg_catalog.timestamptz;
    v_record_creator pg_catalog.uuid;
    v_rows_affected pg_catalog.int4;
    v_existing_user_id pg_catalog.uuid;
    v_existing_entity_type pg_catalog.text;
    v_existing_entity_id pg_catalog.text;
    v_existing_operation pg_catalog.text;
    v_existing_payload pg_catalog.jsonb;
    v_existing_status pg_catalog.text;
    v_processed_count pg_catalog.int4 := 0;
    v_already_applied_count pg_catalog.int4 := 0;
    v_failed_count pg_catalog.int4 := 0;
    v_results pg_catalog.jsonb := '[]'::pg_catalog.jsonb;
    v_inserted_id pg_catalog.uuid;
    v_item_result pg_catalog.jsonb;
BEGIN
    -- 1. Verificación obligatoria de sesión autenticada
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado: se requiere sesión activa de GoTrue'
            USING ERRCODE = '28000';
    END IF;

    -- 2. Obtención segura del rol desde los claims del servidor
    v_user_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'vendedor');

    -- 3. Validación y normalización del argumento de entrada (objeto SyncBatchRequest o arreglo de mutaciones)
    IF p_batch IS NULL THEN
        RAISE EXCEPTION 'El argumento p_batch no puede ser nulo'
            USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.jsonb_typeof(p_batch) = 'array' THEN
        v_mutations := p_batch;
    ELSIF pg_catalog.jsonb_typeof(p_batch) = 'object' THEN
        v_batch_device_id := COALESCE(p_batch ->> 'dispositivoId', 'desconocido');
        v_mutations := p_batch -> 'mutations';
        IF v_mutations IS NULL OR pg_catalog.jsonb_typeof(v_mutations) <> 'array' THEN
            RAISE EXCEPTION 'El campo mutations de p_batch debe ser un arreglo JSONB'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        RAISE EXCEPTION 'El argumento p_batch debe ser un objeto o arreglo JSONB'
            USING ERRCODE = '22023';
    END IF;

    -- 4. Validación de límites del lote (máximo 100 mutaciones por lote, mínimo 1)
    v_batch_length := pg_catalog.jsonb_array_length(v_mutations);
    IF v_batch_length = 0 THEN
        RAISE EXCEPTION 'El lote no contiene mutaciones para procesar'
            USING ERRCODE = '22023';
    END IF;

    IF v_batch_length > 100 THEN
        RAISE EXCEPTION 'El lote excede el límite máximo permitido de 100 mutaciones'
            USING ERRCODE = '22023';
    END IF;

    -- 5. Procesamiento secuencial y seguro de cada mutación en el lote
    FOR v_mutation IN SELECT * FROM pg_catalog.jsonb_array_elements(v_mutations)
    LOOP
        v_idempotency_key := v_mutation ->> 'idempotencyKey';
        v_dispositivo_id := COALESCE(v_mutation ->> 'dispositivoId', v_batch_device_id);
        v_entity_type := v_mutation ->> 'entityType';
        v_entity_id := v_mutation ->> 'entityId';
        v_operation := pg_catalog.upper(pg_catalog.btrim(COALESCE(v_mutation ->> 'operation', '')));
        v_payload := v_mutation -> 'payload';

        -- Validación de timestamp de cliente seguro
        BEGIN
            v_client_timestamp := (v_mutation ->> 'createdAt')::pg_catalog.timestamptz;
        EXCEPTION WHEN OTHERS THEN
            v_client_timestamp := NULL;
        END;

        -- 5.1 Validación estructural de campos obligatorios
        IF v_idempotency_key IS NULL OR pg_catalog.length(v_idempotency_key) <> 64
           OR v_entity_type IS NULL OR pg_catalog.length(pg_catalog.btrim(v_entity_type)) = 0
           OR v_entity_id IS NULL OR pg_catalog.length(pg_catalog.btrim(v_entity_id)) = 0
           OR v_operation NOT IN ('INSERT', 'UPDATE', 'DELETE')
           OR v_client_timestamp IS NULL
           OR (v_operation IN ('INSERT', 'UPDATE') AND (v_payload IS NULL OR pg_catalog.jsonb_typeof(v_payload) <> 'object'))
        THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := pg_catalog.jsonb_build_object(
                'idempotencyKey', COALESCE(v_idempotency_key, 'unknown'),
                'entityType', COALESCE(v_entity_type, 'unknown'),
                'entityId', COALESCE(v_entity_id, 'unknown'),
                'status', 'failed',
                'success', false,
                'error', 'Parámetros de mutación inválidos o incompletos',
                'serverTimestamp', pg_catalog.clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        END IF;

        -- 5.2 Control de permisos según el rol del usuario autenticado (RBAC)
        IF v_user_role = 'vendedor' AND v_operation = 'DELETE' THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := pg_catalog.jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'rejected',
                'success', false,
                'error', 'El rol vendedor no tiene privilegios para ejecutar operaciones de borrado',
                'serverTimestamp', pg_catalog.clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        END IF;

        -- 5.3 Verificación de entidades implementadas vs no implementadas
        IF v_entity_type IN ('ventas', 'pagos_venta', 'movimientos_caja', 'libros', 'ediciones_libro') THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := pg_catalog.jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'rejected',
                'success', false,
                'error', 'Entidad aún no implementada en el backend (prevista para H07+): ' || v_entity_type,
                'serverTimestamp', pg_catalog.clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        ELSIF v_entity_type <> 'sync_test' THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := pg_catalog.jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'rejected',
                'success', false,
                'error', 'Entidad no reconocida en la lista blanca del servidor: ' || v_entity_type,
                'serverTimestamp', pg_catalog.clock_timestamp()
            );
            v_results := v_results || v_item_result;
            CONTINUE;
        END IF;

        -- 5.4 Reserva e Idempotencia Atómica PREVIA a efectos de dominio
        -- Se intenta registrar la clave con status 'processing'.
        -- Gracias al índice UNIQUE sobre idempotency_key:
        -- - Si dos peticiones concurrentes intentan registrar la misma clave, la segunda se bloquea
        --   a nivel de índice hasta que la primera confirme o aborte la transacción.
        -- - Si la clave ya fue registrada previamente, v_inserted_id será NULL.
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
            'processing',
            v_payload,
            v_client_timestamp
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO v_inserted_id;

        -- Si no se pudo insertar, la clave ya existe (o fue confirmada por otra transacción)
        IF v_inserted_id IS NULL THEN
            SELECT usuario_id, entity_type, entity_id, operation, payload, status
            INTO v_existing_user_id, v_existing_entity_type, v_existing_entity_id, v_existing_operation, v_existing_payload, v_existing_status
            FROM public.sync_processed_mutations
            WHERE idempotency_key = v_idempotency_key;

            -- Comparación exhaustiva: usuario, entidad, id, operación Y contenido original (payload)
            IF v_existing_user_id IS NOT NULL THEN
                IF v_existing_user_id <> v_user_id
                   OR v_existing_entity_type <> v_entity_type
                   OR v_existing_entity_id <> v_entity_id
                   OR v_existing_operation <> v_operation
                   OR (v_existing_payload IS DISTINCT FROM v_payload)
                THEN
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'rejected',
                        'success', false,
                        'error', 'Clave de idempotencia reutilizada con parámetros o contenido diferentes (usuario, entidad, operación o payload no coinciden)',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                ELSE
                    -- Mutación previamente procesada de forma idéntica
                    v_already_applied_count := v_already_applied_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'already_applied',
                        'success', true,
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;
            END IF;
        END IF;

        -- 5.5 Aplicación de la operación de dominio ('sync_test') con verificación atómica y reversión ante fallos
        -- Si cualquier verificación o efecto de dominio falla, se revierte/elimina la reserva de idempotencia
        -- para garantizar que ambas pertenezcan a la misma unidad atómica y no quede una mutación registrada
        -- sin efectos reales confirmados.
        BEGIN
            IF v_operation = 'INSERT' THEN
                SELECT created_by INTO v_record_creator
                FROM public.sync_test_records
                WHERE id = v_entity_id;

                IF v_record_creator IS NOT NULL THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'rejected',
                        'success', false,
                        'error', 'El registro ya existe con ID: ' || v_entity_id,
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;

                INSERT INTO public.sync_test_records (
                    id, client_id, payload, created_by, created_at, updated_at
                ) VALUES (
                    v_entity_id, v_dispositivo_id, v_payload, v_user_id,
                    v_client_timestamp, pg_catalog.clock_timestamp()
                );

                GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
                IF v_rows_affected = 0 THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'failed',
                        'success', false,
                        'error', 'Error al insertar registro (0 filas afectadas)',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;

            ELSIF v_operation = 'UPDATE' THEN
                SELECT created_by INTO v_record_creator
                FROM public.sync_test_records
                WHERE id = v_entity_id;

                IF v_record_creator IS NULL THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'rejected',
                        'success', false,
                        'error', 'Registro no encontrado para actualización (0 filas afectadas)',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;

                IF v_record_creator <> v_user_id AND v_user_role NOT IN ('dueno', 'administrador') THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'rejected',
                        'success', false,
                        'error', 'Permiso denegado: no es propietario del registro que intenta actualizar',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;

                UPDATE public.sync_test_records
                SET payload = v_payload,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_entity_id;

                GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
                IF v_rows_affected = 0 THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'failed',
                        'success', false,
                        'error', 'Fallo en actualización de registro (0 filas afectadas)',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;

            ELSIF v_operation = 'DELETE' THEN
                SELECT created_by INTO v_record_creator
                FROM public.sync_test_records
                WHERE id = v_entity_id;

                IF v_record_creator IS NULL THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'rejected',
                        'success', false,
                        'error', 'Registro no encontrado para eliminación (0 filas afectadas)',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;

                IF v_record_creator <> v_user_id AND v_user_role NOT IN ('dueno', 'administrador') THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'rejected',
                        'success', false,
                        'error', 'Permiso denegado: no es propietario del registro que intenta eliminar',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;

                DELETE FROM public.sync_test_records
                WHERE id = v_entity_id;

                GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
                IF v_rows_affected = 0 THEN
                    DELETE FROM public.sync_processed_mutations WHERE id = v_inserted_id;
                    v_failed_count := v_failed_count + 1;
                    v_item_result := pg_catalog.jsonb_build_object(
                        'idempotencyKey', v_idempotency_key,
                        'entityType', v_entity_type,
                        'entityId', v_entity_id,
                        'status', 'failed',
                        'success', false,
                        'error', 'Fallo en eliminación de registro (0 filas afectadas)',
                        'serverTimestamp', pg_catalog.clock_timestamp()
                    );
                    v_results := v_results || v_item_result;
                    CONTINUE;
                END IF;
            END IF;

            -- Efecto de dominio confirmado exitosamente: actualizamos la reserva a 'processed'
            UPDATE public.sync_processed_mutations
            SET status = 'processed',
                server_timestamp = pg_catalog.clock_timestamp()
            WHERE id = v_inserted_id;

            v_processed_count := v_processed_count + 1;
            v_item_result := pg_catalog.jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'processed',
                'success', true,
                'serverTimestamp', pg_catalog.clock_timestamp()
            );
            v_results := v_results || v_item_result;

        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_item_result := pg_catalog.jsonb_build_object(
                'idempotencyKey', v_idempotency_key,
                'entityType', v_entity_type,
                'entityId', v_entity_id,
                'status', 'failed',
                'success', false,
                'error', 'Fallo en persistencia: ' || SQLERRM,
                'serverTimestamp', pg_catalog.clock_timestamp()
            );
            v_results := v_results || v_item_result;
        END;
    END LOOP;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'processedCount', v_processed_count,
        'alreadyAppliedCount', v_already_applied_count,
        'failedCount', v_failed_count,
        'results', v_results
    );
END;
$$;

-- Revocación de acceso anónimo/público y asignación estricta a roles autenticados
REVOKE ALL ON FUNCTION public.sync_push_mutations(pg_catalog.jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_push_mutations(pg_catalog.jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_push_mutations(pg_catalog.jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_push_mutations(pg_catalog.jsonb) TO service_role;

-- Permisos de lectura en tablas bajo RLS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.sync_processed_mutations TO authenticated, service_role;
GRANT SELECT ON TABLE public.sync_test_records TO authenticated, service_role;
