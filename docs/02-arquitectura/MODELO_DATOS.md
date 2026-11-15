# Modelo de Datos Relacional y Estrategia de Persistencia (MODELO_DATOS.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda<br>
**Documento:** MODELO_DATOS.md<br>
**Estado:** Consolidado y Refinado en H04<br>
**Trazabilidad:** [../01-requerimientos/SRS.md](../01-requerimientos/SRS.md) | [../01-requerimientos/REGLAS_NEGOCIO.md](../01-requerimientos/REGLAS_NEGOCIO.md) | [ARQUITECTURA.md](ARQUITECTURA.md) | [../03-estandares/DICCIONARIO_DATOS.md](../03-estandares/DICCIONARIO_DATOS.md)

---

## 1. Principios de Diseño Relacional e Integridad Offline

1. **Claves Primarias Descentralizadas:** Todas las tablas utilizan **UUID v4** generados en el cliente como clave primaria, permitiendo inserciones concurrentes y autónomas sin dependencia de red ni colisiones ([DEC-009](../06-gestion/DECISIONES.md#dec-009-arquitectura-offline-first-con-sqlite-local-y-supabase-remoto)).
2. **Inmutabilidad de Ledgers Financieros (Anti-LWW):** Las tablas de transacciones (`ventas`, `pagos_venta`, `movimientos_caja`, `abonos_proveedor`) operan bajo un modelo **Append-Only**. Se prohíben mutaciones destructivas (`UPDATE`/`DELETE`) sobre importes o medios de pago; toda corrección o anulación se registra como un nuevo asiento contrapartida auditable.
3. **Idempotencia Estricta por Hash:** Cada mutación o pago incluye un campo `idempotency_key` (`SHA256(dispositivo_id + entidad_id + operacion + timestamp)`). PostgreSQL impone una restricción única (`UNIQUE`) que impide duplicidades financieras ante reintentos de red.
4. **Trazabilidad Multi-dispositivo:** Todo registro de negocio incluye `dispositivo_id` (UUID de hardware/instalación) y `usuario_id`, garantizando auditoría del origen de cada transacción.
5. **Eliminación Lógica (*Soft Deletes*):** Tablas de catálogo, proveedores y maestros incorporan `deleted_at (TIMESTAMPTZ NULL)`. Las bajas lógicas se propagan como mutaciones de actualización, preservando la integridad referencial histórica.
6. **Desacoplamiento Bibliográfico:** Separación estricta entre la obra intelectual (`libros`), sus variantes físicas y de conservación (`ediciones_libro`) y la clasificación temática (`categorias`, `libro_categoria`) ([DEC-004](../06-gestion/DECISIONES.md#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación)).
7. **Durabilidad SQLite Diferenciada:** Cumpliendo la directriz de H02.1, SQLite aplica `PRAGMA synchronous = FULL` en transacciones financieras críticas para asegurar persistencia física (*fsync*) en disco, y `NORMAL` en consultas de catálogo.
8. **Representación Monetaria Entera en SQLite y Conversión a PostgreSQL:** En SQLite local, todos los importes monetarios se almacenan como `INTEGER` en céntimos (eliminando imprecisiones por coma flotante binaria IEEE 754). En PostgreSQL (Supabase), se almacenan canónicamente como `NUMERIC(12,2)`. La conversión bidireccional se define de forma estricta:
   $$\text{PostgreSQL} = \frac{\text{céntimos}}{100.00}, \quad \text{SQLite} = \operatorname{CAST}(\operatorname{ROUND}(\text{PostgreSQL} \times 100) \text{ AS INTEGER})$$
   Garantizando consistencia aritmética exacta en cálculos de totales, saldos derivados y arqueos de caja.

---

## 2. Diagramas Entidad-Relación (ERD)

Para garantizar legibilidad visual conforme al estándar, el modelo se segrega en tres dominios complementarios.

### 2.1 Dominio 1: Catálogo Bibliográfico, Proveedores y Compras

```mermaid
erDiagram
    CATEGORIAS ||--o{ LIBRO_CATEGORIA : "clasifica"
    LIBROS ||--o{ LIBRO_CATEGORIA : "pertenece a"
    LIBROS ||--|{ EDICIONES_LIBRO : "tiene ediciones"

    PROVEEDORES ||--o{ CUENTAS_BANCARIAS_PROVEEDOR : "registra cuentas"
    PROVEEDORES ||--o{ LIBRO_PROVEEDOR : "cotiza"
    EDICIONES_LIBRO ||--o{ LIBRO_PROVEEDOR : "ofrecida por"

    PROVEEDORES ||--o{ PEDIDOS_PROVEEDOR : "suministra"
    PEDIDOS_PROVEEDOR ||--|{ PEDIDO_DETALLES : "contiene ítems"
    EDICIONES_LIBRO ||--o{ PEDIDO_DETALLES : "solicitada en (opcional)"

    PEDIDOS_PROVEEDOR ||--o{ RECEPCIONES_PEDIDO : "recibe entregas"
    PROVEEDORES ||--o{ ABONOS_PROVEEDOR : "recibe pagos"
    PEDIDOS_PROVEEDOR ||--o{ ABONOS_PROVEEDOR : "amortiza (opcional)"

    CATEGORIAS {
        uuid id PK
        string nombre
        string codigo
        boolean activo
    }

    LIBROS {
        uuid id PK
        string titulo
        string autor
        string editorial
        string isbn_referencial
        timestamp deleted_at
    }

    EDICIONES_LIBRO {
        uuid id PK
        uuid libro_id FK
        string edicion
        int anio
        string formato
        string estado_conservacion
        decimal precio_referencial
        string portada_url
        timestamp deleted_at
    }

    PROVEEDORES {
        uuid id PK
        string nombre
        string contacto
        string telefono
        string whatsapp
        string email
        string especialidades
        boolean activo
        timestamp deleted_at
    }

    CUENTAS_BANCARIAS_PROVEEDOR {
        uuid id PK
        uuid proveedor_id FK
        string banco
        string tipo_cuenta
        string numero_cuenta_cifrado
        string titular_cifrado
    }

    LIBRO_PROVEEDOR {
        uuid id PK
        uuid edicion_libro_id FK
        uuid proveedor_id FK
        decimal costo_referencial
        string codigo_proveedor
    }

    PEDIDOS_PROVEEDOR {
        uuid id PK
        uuid proveedor_id FK "nullable inicialmente"
        uuid dispositivo_id
        string estado_pedido
        decimal total_estimado
        timestamp fecha_solicitud
    }

    PEDIDO_DETALLES {
        uuid id PK
        uuid pedido_id FK
        uuid edicion_libro_id FK "nullable para no catalogados"
        string descripcion_item
        string foto_referencia_url
        int cantidad_solicitada
        int cantidad_recibida
        decimal costo_unitario
    }

    RECEPCIONES_PEDIDO {
        uuid id PK
        uuid pedido_id FK
        uuid dispositivo_id
        uuid usuario_id
        string numero_guia
        timestamp fecha_recepcion
    }

    ABONOS_PROVEEDOR {
        uuid id PK
        uuid proveedor_id FK
        uuid pedido_id FK "nullable"
        uuid sesion_caja_id FK "nullable"
        uuid dispositivo_id
        decimal monto
        string medio_pago
        string idempotency_key UQ
    }
```

### 2.2 Dominio 2: Ventas, Cobros, Tesorería y Caja

```mermaid
erDiagram
    USUARIOS ||--o{ SESIONES_CAJA : "abre/cierra"
    USUARIOS ||--o{ VENTAS : "registra como vendedor"
    USUARIOS ||--o{ AUTORIZACIONES_OVERRIDE : "autoriza como supervisor"

    SESIONES_CAJA ||--o{ MOVIMIENTOS_CAJA : "registra flujo efectivo"
    SESIONES_CAJA ||--o{ ARQUEOS_DETALLE : "desglosa conteo físico"
    SESIONES_CAJA ||--o{ VENTAS : "contiene ventas"
    SESIONES_CAJA ||--o{ GASTOS : "imputa egresos"

    VENTAS ||--|{ VENTA_DETALLES : "desglosa ítems (nullable venta rápida)"
    EDICIONES_LIBRO ||--o{ VENTA_DETALLES : "referencia edición"
    VENTAS ||--|{ PAGOS_VENTA : "recibe pagos"
    VENTAS ||--o{ AUTORIZACIONES_OVERRIDE : "justifica fiado/anulación"

    USUARIOS {
        uuid id PK
        uuid auth_id FK
        string rol
        string nombre
        string email
        boolean activo
    }

    AUTORIZACIONES_OVERRIDE {
        uuid id PK
        string operacion_tipo
        uuid entidad_id
        uuid autorizador_id FK
        uuid dispositivo_id
        string metodo
        string firma_hmac
        timestamp caducidad_at
    }

    SESIONES_CAJA {
        uuid id PK
        uuid dispositivo_id
        uuid usuario_apertura_id FK
        uuid usuario_cierre_id FK "nullable"
        decimal monto_inicial
        decimal monto_final_calculado
        decimal monto_final_declarado
        decimal diferencia
        string estado_caja
        timestamp fecha_apertura
        timestamp fecha_cierre
    }

    ARQUEOS_DETALLE {
        uuid id PK
        uuid sesion_caja_id FK
        string medio_pago
        decimal monto_contado
    }

    MOVIMIENTOS_CAJA {
        uuid id PK
        uuid sesion_caja_id FK
        uuid dispositivo_id
        string tipo_movimiento
        decimal monto
        string medio_pago
        string idempotency_key UQ
    }

    GASTOS {
        uuid id PK
        uuid sesion_caja_id FK
        uuid dispositivo_id
        uuid usuario_id FK
        string categoria
        decimal monto
        boolean afecta_caja_efectivo
        string comprobante_url
        string idempotency_key UQ
    }

    VENTAS {
        uuid id PK
        uuid sesion_caja_id FK
        uuid vendedor_id FK
        uuid autorizador_id FK "nullable"
        uuid dispositivo_id
        string tipo_venta
        string serie
        int correlativo
        string cliente_nombre "nullable (obligatorio si fiado)"
        string cliente_documento "nullable (obligatorio si fiado)"
        decimal total_bruto
        decimal total_descuentos
        decimal total_neto
        decimal total_pagado
        decimal saldo_pendiente
        string estado_venta
        string estado_pago
        string estado_entrega
        string estado_regularizacion
        string foto_soporte_url
        string idempotency_key UQ
    }

    VENTA_DETALLES {
        uuid id PK
        uuid venta_id FK
        uuid edicion_libro_id FK "nullable si venta rápida"
        string descripcion_item
        int cantidad
        decimal precio_unitario
        decimal descuento
        decimal subtotal
    }

    PAGOS_VENTA {
        uuid id PK
        uuid venta_id FK
        uuid sesion_caja_id FK
        uuid dispositivo_id
        uuid usuario_id FK
        decimal monto
        string medio_pago
        string referencia_pago
        string idempotency_key UQ
        timestamp fecha_pago
    }
```

### 2.3 Dominio 3: Sincronización, Multimedia y Auditoría Central

```mermaid
erDiagram
    SYNC_OUTBOX ||--o{ ARCHIVOS_MULTIMEDIA : "referencia subidas pendientes"

    ARCHIVOS_MULTIMEDIA {
        uuid id PK
        string entidad_tipo
        uuid entidad_id
        string bucket
        string path_remoto
        string uri_local
        string hash_sha256
        int tamano_bytes
        string sync_status
    }

    SYNC_OUTBOX {
        uuid id PK
        string entity_type
        uuid entity_id
        string operation
        text payload
        string idempotency_key UQ
        string status
        int retry_count
        timestamp created_at
    }

    SYNC_PROCESSED_MUTATIONS {
        uuid id PK
        string idempotency_key UQ
        uuid dispositivo_id
        uuid usuario_id
        string entity_type
        uuid entity_id
        string operation
        timestamp processed_at
    }

    AUDITORIA_FINANCIERA {
        uuid id PK
        string entidad_tipo
        uuid entidad_id
        uuid dispositivo_id
        uuid usuario_id
        string tipo_evento
        decimal monto_impactado
        decimal balance_resultante
        jsonb metadata_json
        timestamp created_at
    }
```

---

## 3. Resolución de Escenarios Críticos de Negocio y Datos

### 3.1 Ventas Rápidas sin Detalles Iniciales (`RN-VTA-002`, `DEC-011`)
- La cabecera `ventas` se inserta con `tipo_venta = 'rapida'`, `estado_regularizacion = 'pendiente'` y `foto_soporte_url` apuntando a la fotografía local.
- No se fuerza la creación inmediata de registros en `venta_detalles`.
- La regularización posterior inserta los renglones correspondientes en `venta_detalles` asociando las `ediciones_libro` identificadas y actualiza `estado_regularizacion = 'completada'`.

### 3.2 Pedidos de Libros Faltantes No Catalogados (`RN-PED-003`)
- `pedidos_proveedor.proveedor_id` es nullable en su creación inicial (`estado_pedido = 'borrador_sin_asignar'`).
- En `pedido_detalles`, la columna `edicion_libro_id` es nullable; se registran `descripcion_item` (texto libre ingresado por el vendedor) y `foto_referencia_url` (portada capturada con cámara). Al catalogarse formalmente, se enlaza la edición definitiva.

### 3.3 Pagos Parciales, Entregas Fiadas y Retención (`RN-VTA-003`, `RN-PAG-002`)
- Si `total_pagado < total_neto`:
  - **Mercadería Retenida:** `estado_entrega = 'retenido'`, `estado_pago = 'parcial'`. No requiere autorización de supervisor.
  - **Entrega Física con Saldo (Fiado):** `estado_entrega = 'entregado_saldo_pendiente'`, `estado_pago = 'parcial'`. Exige obligatoriamente `autorizador_id NOT NULL` vinculado a un registro en `autorizaciones_override`.

### 3.4 Operaciones Financieras Inmutables y Conciliación de Caja (`RN-CAJ-004`, `DEC-007`)
- La tabla `movimientos_caja` es de solo inserción. Los errores se compensan mediante movimientos de contra-asiento de tipo `ajuste_sobrante` o `ajuste_faltante`.
- En cierres offline, `sesiones_caja` se inserta con `estado_caja = 'cierre_provisorio_offline'`. La función central de conciliación evalúa:
  $$\Delta_{\text{caja}} = \text{monto\_final\_declarado} - (\text{monto\_inicial} + \sum \text{ingresos\_efectivo} - \sum \text{egresos\_efectivo})$$
  Transicionando a `conciliado_conforme` ($\Delta = 0$) o `conciliado_con_diferencia` ($\Delta \neq 0$) bajo aprobación del Administrador.

### 3.5 Operaciones Multi-dispositivo y Deduplicación
- Todo dispositivo Android posee un `dispositivo_id` unívoco persistido en Keystore.
- La tabla central `sync_processed_mutations` en PostgreSQL mantiene un índice único sobre `idempotency_key`. Cualquier intento de reenvío por reconexión es descartado de forma idempotente sin duplicar pagos ni ventas.

### 3.6 Eliminación Lógica y Auditoría
- Se prohíbe el borrado físico (`DELETE`) en catálogo y proveedores. La columna `deleted_at` almacena la marca UTC de baja lógica.
- Las consultas activas filtran `WHERE deleted_at IS NULL`. La sincronización transmite la mutación `UPDATE ... SET deleted_at = ...` garantizando coherencia en todos los clientes.

### 3.7 Correlativos de Notas Internas en Multi-terminal Offline (`serie-correlativo`)
- Para evitar colisiones en numeración y cuellos de botella de red, cada terminal Android tiene asignada una serie unívoca (e.g. `'NV01'`, `'NV02'`).
- El correlativo es un entero estrictamente monotónico generado de forma autónoma en cada SQLite local (`1, 2, 3...`).
- En PostgreSQL se aplica la restricción compuesta `UNIQUE(serie, correlativo)`. El `UUID v4` se mantiene como clave primaria universal e inmutable.

### 3.8 Validación Transaccional de Saldos Derivados y Prevención de Sobrepagos Concurrentes (`RN-VTA-003`, `RN-PAG-002`)
- **En SQLite local:** Todo registro de pago se ejecuta dentro de una transacción atómica exclusiva (`BEGIN IMMEDIATE`). El servicio de dominio verifica que $\text{total\_pagado} + \text{nuevo\_abono} \le \text{total\_neto}$; si el abono supera la deuda, la transacción se revierte con error explícito de sobrepago.
- **En PostgreSQL (Supabase RPC):** Se mitigan condiciones de carrera concurrentes mediante bloqueo pesimista `SELECT ... FOR UPDATE` sobre la cabecera `ventas`, recalculando atómicamente $\text{saldo\_pendiente} = \text{total\_neto} - \sum \text{pagos}$. Si $\text{saldo\_pendiente} < 0$, la función RPC aborta la transacción y registra el intento anómalo en `auditoria_financiera`.

### 3.9 Identificación Mínima Obligatoria de Clientes con Saldo Pendiente (`RN-VTA-003`)
- Queda prohibida la entrega de mercadería fiada a clientes anónimos.
- El modelo relacional en PostgreSQL y SQLite impone la restricción de integridad a nivel de tabla:
  ```sql
  CHECK (
    saldo_pendiente = 0 OR (
      cliente_nombre IS NOT NULL AND LENGTH(TRIM(cliente_nombre)) >= 3 AND
      cliente_documento IS NOT NULL AND LENGTH(TRIM(cliente_documento)) >= 6
    )
  )
  ```
- Exige capturar el nombre del cliente y su documento de identidad (DNI/CE) o número telefónico de contacto antes de confirmar la entrega con saldo pendiente.

---

## 4. Matriz de Entidades y Estrategia de Persistencia

| Entidad / Tabla | Persistencia | Propósito / Dominio | Motor Primario |
| :--- | :---: | :--- | :--- |
| `usuarios` | Replicada | Perfil de operadores y asignación de roles. | PostgreSQL (Supabase) + SQLite |
| `autorizaciones_override` | Replicada | Bitácora de autorizaciones supervisor offline/online. | PostgreSQL + SQLite |
| `usuarios_sesion_local` | Exclusiva SQLite | Caché de sesión local, PIN y tokens biométricos. | SQLite local |
| `credenciales_revocadas_local`| Exclusiva SQLite | Lista de revocación local (CRL) sincronizada. | SQLite local |
| `categorias` | Replicada | Familias y géneros bibliográficos. | PostgreSQL + SQLite |
| `libros` | Replicada | Obras intelectuales base (título, autor, ISBN). | PostgreSQL + SQLite |
| `libro_categoria` | Replicada | Clasificación temática N:M. | PostgreSQL + SQLite |
| `ediciones_libro` | Replicada | Variantes físicas, formatos y estados nuevo/usado. | PostgreSQL + SQLite |
| `proveedores` | Replicada | Directorio de distribuidores y editoriales. | PostgreSQL + SQLite |
| `cuentas_bancarias_proveedor` | Replicada | Cuentas bancarias cifradas con AES-256 (`RN-PRV-002`). | PostgreSQL + SQLite |
| `libro_proveedor` | Replicada | Historial de costos variables y códigos proveedor. | PostgreSQL + SQLite |
| `pedidos_proveedor` | Replicada | Órdenes de abastecimiento y pedidos faltantes. | PostgreSQL + SQLite |
| `pedido_detalles` | Replicada | Renglones de pedidos (catalogados o texto libre). | PostgreSQL + SQLite |
| `recepciones_pedido` | Replicada | Registro de recepciones fraccionadas con guía. | PostgreSQL + SQLite |
| `abonos_proveedor` | Replicada | Egresos y amortizaciones de deuda a proveedores. | PostgreSQL + SQLite |
| `sesiones_caja` | Replicada | Control de apertura, turno, arqueo y cierre. | PostgreSQL + SQLite |
| `arqueos_detalle` | Replicada | Desglose físico del conteo por medio de pago. | PostgreSQL + SQLite |
| `movimientos_caja` | Replicada | Ledger append-only de entradas y salidas de efectivo. | PostgreSQL + SQLite |
| `gastos` | Replicada | Egresos operativos y comprobantes de mostrador. | PostgreSQL + SQLite |
| `ventas` | Replicada | Cabecera comercial de ventas normales y rápidas. | PostgreSQL + SQLite |
| `venta_detalles` | Replicada | Ítems vendidos y subtotales acordados. | PostgreSQL + SQLite |
| `pagos_venta` | Replicada | Ledger append-only de cobros (efectivo, POS, QR). | PostgreSQL + SQLite |
| `archivos_multimedia` | Replicada | Catálogo de imágenes, hashes y rutas a Storage. | PostgreSQL + SQLite |
| `sync_outbox` | Exclusiva SQLite | Cola local transaccional de mutaciones pendientes. | SQLite local |
| `sync_processed_mutations` | Exclusiva PG | Tabla de deduplicación e idempotencia global. | PostgreSQL (Supabase) |
| `auditoria_financiera` | Exclusiva PG | Registro forense append-only de eventos financieros. | PostgreSQL (Supabase) |
