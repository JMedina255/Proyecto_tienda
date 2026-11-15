# Modelo de Datos Preliminar (MODELO_DATOS.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda  
**Documento:** MODELO_DATOS.md  
**Estado:** Modelo preliminar / Candidato para H00  
**Trazabilidad:** [../01-requerimientos/SRS.md](../01-requerimientos/SRS.md) | [../01-requerimientos/REGLAS_NEGOCIO.md](../01-requerimientos/REGLAS_NEGOCIO.md) | [../06-gestion/DECISIONES.md](../06-gestion/DECISIONES.md)

---

## 1. Principios de Diseño Relacional

1. **Descentralización de Claves Primarias:** Todas las tablas utilizan como clave primaria identificadores universales únicos **UUID v4** generados en el dispositivo cliente, garantizando la inserción concurrente y autónoma sin colisiones en modo *offline* (ref: [DEC-009](../06-gestion/DECISIONES.md#dec-009-arquitectura-offline-first-con-sqlite-local-y-supabase-remoto)).
2. **Homogeneidad entre SQLite y PostgreSQL:** Las tablas locales en SQLite tendrán una estructura equivalente a las tablas centrales en PostgreSQL de Supabase, facilitando la replicación directa de esquemas.
3. **Auditoría y Borrado Lógico:** Cada registro incluye marcas de tiempo UTC (`created_at`, `updated_at`), versión de registro (`sync_version`) y soporte para eliminación lógica (`deleted_at`) para propagar bajas sin pérdida de integridad referencial.
4. **Desacoplamiento Bibliográfico:** Se separa el título base (`libros`) de sus variantes físicas y comerciales (`ediciones_libro`) para reflejar fielmente la condición de libros nuevos y usados (ref: [DEC-004](../06-gestion/DECISIONES.md#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación)).

---

## 2. Diagrama Entidad-Relación Preliminar (ERD)

```mermaid
erDiagram
    USUARIOS ||--o{ SESIONES_CAJA : "abre/cierra"
    USUARIOS ||--o{ VENTAS : "registra como vendedor"
    USUARIOS ||--o{ VENTAS : "autoriza fiado"
    USUARIOS ||--o{ GASTOS : "registra"

    LIBROS ||--|{ EDICIONES_LIBRO : "tiene ediciones"
    PROVEEDORES ||--o{ LIBRO_PROVEEDOR : "suministra"
    EDICIONES_LIBRO ||--o{ LIBRO_PROVEEDOR : "ofrecida por"

    SESIONES_CAJA ||--o{ MOVIMIENTOS_CAJA : "contiene"
    SESIONES_CAJA ||--o{ VENTAS : "asociada a"
    SESIONES_CAJA ||--o{ GASTOS : "imputa egresos"

    VENTAS ||--|{ VENTA_DETALLES : "desglosa"
    EDICIONES_LIBRO ||--o{ VENTA_DETALLES : "incluida en"
    VENTAS ||--|{ PAGOS_VENTA : "recibe pagos"

    PROVEEDORES ||--o{ PEDIDOS_PROVEEDOR : "atiende"
    PEDIDOS_PROVEEDOR ||--|{ PEDIDO_DETALLES : "contiene ítems"
    EDICIONES_LIBRO ||--o{ PEDIDO_DETALLES : "solicitada en"
    PROVEEDORES ||--o{ ABONOS_PROVEEDOR : "recibe abonos"
    PEDIDOS_PROVEEDOR ||--o{ ABONOS_PROVEEDOR : "vinculado a"

    USUARIOS {
        uuid id PK
        uuid auth_id FK
        string rol
        string nombre
        string email
        boolean activo
    }

    LIBROS {
        uuid id PK
        string titulo
        string autor
        string editorial
        string isbn
        text sinopsis
        timestamp created_at
        timestamp updated_at
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
        timestamp created_at
        timestamp updated_at
    }

    PROVEEDORES {
        uuid id PK
        string nombre
        string contacto
        string telefono
        string email
        string direccion
        boolean activo
    }

    LIBRO_PROVEEDOR {
        uuid id PK
        uuid edicion_libro_id FK
        uuid proveedor_id FK
        decimal costo_referencial
        string codigo_proveedor
    }

    SESIONES_CAJA {
        uuid id PK
        uuid usuario_apertura_id FK
        uuid usuario_cierre_id FK
        decimal monto_inicial
        decimal monto_final_calculado
        decimal monto_final_declarado
        decimal diferencia
        string estado_caja
        timestamp fecha_apertura
        timestamp fecha_cierre
    }

    MOVIMIENTOS_CAJA {
        uuid id PK
        uuid sesion_caja_id FK
        string tipo_movimiento
        decimal monto
        string medio_pago
        string motivo
        timestamp created_at
    }

    VENTAS {
        uuid id PK
        uuid sesion_caja_id FK
        uuid vendedor_id FK
        uuid autorizador_id FK
        string cliente_nombre
        string cliente_documento
        decimal total_bruto
        decimal total_descuentos
        decimal total_neto
        decimal total_pagado
        decimal saldo_pendiente
        string estado_venta
        string estado_pago
        string estado_entrega
        boolean es_venta_rapida
        string foto_comprobante_url
        string sync_status
        timestamp created_at
    }

    VENTA_DETALLES {
        uuid id PK
        uuid venta_id FK
        uuid edicion_libro_id FK
        string descripcion_item
        int cantidad
        decimal precio_unitario
        decimal descuento
        decimal subtotal
    }

    PAGOS_VENTA {
        uuid id PK
        uuid venta_id FK
        decimal monto
        string medio_pago
        string referencia_pago
        timestamp fecha_pago
    }

    GASTOS {
        uuid id PK
        uuid sesion_caja_id FK
        string categoria
        decimal monto
        boolean afecta_caja_efectivo
        string comprobante_url
        string descripcion
        timestamp fecha_gasto
    }

    PEDIDOS_PROVEEDOR {
        uuid id PK
        uuid proveedor_id FK
        string estado_pedido
        timestamp fecha_solicitud
        timestamp fecha_estimada
        decimal total_estimado
        text observaciones
    }

    PEDIDO_DETALLES {
        uuid id PK
        uuid pedido_id FK
        uuid edicion_libro_id FK
        string descripcion_libro
        int cantidad_solicitada
        int cantidad_recibida
        decimal costo_unitario
    }

    ABONOS_PROVEEDOR {
        uuid id PK
        uuid proveedor_id FK
        uuid pedido_id FK
        decimal monto
        string medio_pago
        string comprobante_url
        timestamp fecha_abono
    }
```

---

## 3. Catálogo de Entidades Candidatas

### 3.1 Módulo de Identidad y Acceso
- **`usuarios`**: Almacena el perfil operativo del personal en la librería, vinculado al `auth.users` de Supabase a través de `auth_id`.
  - Roles admitidos: `'admin'`, `'dueno'`, `'vendedor'`.

### 3.2 Módulo de Catálogo Bibliográfico
- **`libros`**: Representa la obra intelectual independientemente de su tiraje o estado físico.
  - Atributos clave: `id`, `titulo`, `autor`, `editorial`, `isbn`, `sinopsis`.
- **`ediciones_libro`**: Representa la variante física comercializable de un libro.
  - Atributos clave: `id`, `libro_id`, `edicion` (ej. "1ra ed.", "Conmemorativa"), `formato` (ej. "Tapa dura", "Bolsillo"), `estado_conservacion` (`'nuevo'`, `'usado'`), `precio_referencial`, `portada_url`.
- **`libro_proveedor`**: Tabla asociativa entre una edición de libro y un distribuidor/proveedor.
  - Atributos clave: `edicion_libro_id`, `proveedor_id`, `costo_referencial`, `codigo_proveedor`.

### 3.3 Módulo de Tesorería y Caja
- **`sesiones_caja`**: Controla el ciclo de vida de un turno o jornada de mostrador.
  - Atributos clave: `monto_inicial`, `monto_final_calculado`, `monto_final_declarado`, `diferencia`, `estado_caja` (`'abierta'`, `'cierre_provisorio_offline'`, `'cerrada_conciliada'`).
- **`movimientos_caja`**: Registro granular de entradas y salidas de efectivo dentro de la sesión de caja activa.
  - Atributos clave: `tipo_movimiento` (`'ingreso_venta'`, `'egreso_gasto'`, `'retiro_propietario'`, `'ingreso_extra'`), `monto`, `medio_pago`.

### 3.4 Módulo de Ventas y Cobranzas
- **`ventas`**: Encabezado de la transacción comercial en mostrador.
  - Atributos clave: `total_bruto`, `total_descuentos`, `total_neto`, `total_pagado`, `saldo_pendiente`.
  - Estados: `estado_venta` (`'borrador'`, `'completada'`, `'pendiente_regularizacion'`, `'pendiente_cobro'`, `'anulada'`), `estado_pago` (`'pendiente'`, `'parcial'`, `'total'`, `'anulado'`), `estado_entrega` (`'retenido'`, `'entregado_total'`, `'entregado_saldo_pendiente'`).
  - Atributos de venta rápida: `es_venta_rapida` (boolean), `foto_comprobante_url`.
  - Atributos de autorización: `autorizador_id` (nullable, requerido si `saldo_pendiente > 0` y se entrega el libro).
- **`venta_detalles`**: Ítems incluidos en la venta.
  - Atributos clave: `edicion_libro_id` (nullable temporalmente en ventas rápidas), `descripcion_item`, `cantidad`, `precio_unitario`, `descuento`, `subtotal`.
- **`pagos_venta`**: Registro individual de cada abono o pago recibido para una venta.
  - Atributos clave: `monto`, `medio_pago` (`'efectivo'`, `'tarjeta_pos'`, `'billetera_digital'`), `referencia_pago`.

### 3.5 Módulo de Egresos Operativos
- **`gastos`**: Registro de desembolsos no asociados a compra de libros (servicios, alquiler, suministros).
  - Atributos clave: `categoria` (`'alquiler'`, `'servicios'`, `'suministros'`, `'personal'`, `'otros'`), `monto`, `afecta_caja_efectivo`, `comprobante_url`.

### 3.6 Módulo de Proveedores y Compras
- **`proveedores`**: Catálogo de editoriales, distribuidoras y particulares.
  - Atributos clave: `nombre`, `contacto`, `telefono`, `email`, `direccion`, `activo`.
- **`pedidos_proveedor`**: Órdenes de reposición o pedidos de libros faltantes.
  - Atributos clave: `proveedor_id` (nullable inicialmente para pedidos de faltantes sin asignar), `estado_pedido` (`'borrador_sin_asignar'`, `'asignado'`, `'enviado'`, `'recepcion_parcial'`, `'recibido_total'`, `'cancelado'`).
- **`pedido_detalles`**: Libros y cantidades solicitadas/recibidas en un pedido.
  - Atributos clave: `cantidad_solicitada`, `cantidad_recibida`, `costo_unitario`.
- **`abonos_proveedor`**: Pagos parciales o totales efectuados a distribuidores.
  - Atributos clave: `proveedor_id`, `pedido_id` (nullable), `monto`, `medio_pago`, `comprobante_url`.

### 3.7 Módulo de Sincronización Local (Específico de SQLite)
- **`sync_outbox`**: Cola de mutaciones generadas localmente para transmisión asíncrona hacia Supabase.
  - Atributos clave: `id` (UUID), `tabla_origen`, `operacion` (`'INSERT'`, `'UPDATE'`, `'DELETE'`), `payload` (JSON texto), `client_timestamp` (UTC), `sync_status` (`'pending'`, `'in_flight'`, `'failed'`, `'synced'`), `retry_count`.

---

## 4. Estado del Documento y Próximos Pasos

Este modelo es **preliminar**. No se han generado tablas ni migraciones físicas en este hito (ref: H00 - Restricciones). En el hito **H01** se procederá a la definición formal de los tipos TypeScript y los esquemas DDL en `DICCIONARIO_DATOS.md`.
