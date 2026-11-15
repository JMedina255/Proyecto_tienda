# Diccionario de Datos — Especificación y Catálogo Preliminar (DICCIONARIO_DATOS.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda  
**Documento:** DICCIONARIO_DATOS.md  
**Estado:** Plantilla base y Catálogo preliminar consolidado para H00  
**Trazabilidad:** [../02-arquitectura/MODELO_DATOS.md](../02-arquitectura/MODELO_DATOS.md) | [../01-requerimientos/REGLAS_NEGOCIO.md](../01-requerimientos/REGLAS_NEGOCIO.md)

---

## 1. Metodología y Plantilla Estándar de Documentación

Toda entidad de base de datos (tanto en la réplica local de SQLite como en el PostgreSQL de Supabase) debe documentarse bajo la siguiente plantilla tabular:

### [Nombre de la Entidad / Tabla]
- **Descripción funcional:** Propósito operativo del registro.
- **Tipo de persistencia:** Local (SQLite) / Central (PostgreSQL) / Replicada (Ambas).
- **Políticas RLS aplicables (Supabase):** Roles con permisos `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

| Campo | Tipo PostgreSQL | Tipo SQLite | Nulo | Clave / Restricción | Valor por Defecto | Descripción de Negocio | Relación (FK) |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | `gen_random_uuid()` | Identificador universal único del registro. | N/A |
| `[campo]` | `[tipo]` | `[tipo]` | [Sí/No] | [FK / UQ / CHECK] | [defecto] | [Propósito funcional y reglas asociadas] | `tabla.columna` |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | `timezone('utc', now())` | Fecha y hora UTC de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | `timezone('utc', now())` | Fecha y hora UTC de última actualización. | N/A |
| `sync_status` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'pending'` | Estado en motor de sincronización. | N/A |

---

## 2. Catálogo Preliminar de Tablas Base

A continuación se documentan las entidades candidatas preliminares definidas en [MODELO_DATOS.md](../02-arquitectura/MODELO_DATOS.md). Esta especificación servirá de base directa para las migraciones DDL en hitos posteriores.

### 2.1 Tabla: `libros`
- **Descripción funcional:** Obras bibliográficas registradas en la librería (nivel título genérico).
- **Persistencia:** Replicada (SQLite y PostgreSQL).

| Campo | Tipo PG | Tipo SQLite | Nulo | Clave / Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único del libro. | N/A |
| `titulo` | `VARCHAR(255)` | `TEXT` | No | NOT NULL | N/A | Título de la obra literaria o técnica. | N/A |
| `autor` | `VARCHAR(255)` | `TEXT` | No | NOT NULL | N/A | Autor principal o compilador. | N/A |
| `editorial` | `VARCHAR(150)` | `TEXT` | Sí | N/A | `NULL` | Casa editorial de referencia. | N/A |
| `isbn` | `VARCHAR(20)` | `TEXT` | Sí | INDEX | `NULL` | Código normalizado ISBN-10 o ISBN-13. | N/A |
| `sinopsis` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Breve reseña o contenido del libro. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |
| `sync_status` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'synced'` | Estado de sincronización. | N/A |

---

### 2.2 Tabla: `ediciones_libro`
- **Descripción funcional:** Variantes físicas y comerciales comercializables asociadas a un libro (nuevo, usado, formatos).
- **Persistencia:** Replicada.

| Campo | Tipo PG | Tipo SQLite | Nulo | Clave / Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único de la edición. | N/A |
| `libro_id` | `UUID` | `TEXT` | No | FK | N/A | Libro matriz al que pertenece. | `libros.id` |
| `edicion` | `VARCHAR(100)` | `TEXT` | Sí | N/A | `'Estándar'` | Número o mención de la edición. | N/A |
| `anio` | `INTEGER` | `INTEGER` | Sí | CHECK (> 1500) | `NULL` | Año de publicación de la edición. | N/A |
| `formato` | `VARCHAR(50)` | `TEXT` | No | CHECK | `'tapa_blanda'` | Formato (tapa blanda, dura, bolsillo). | N/A |
| `estado_conservacion`| `VARCHAR(20)`| `TEXT` | No | CHECK | `'nuevo'` | Estado físico (`'nuevo'`, `'usado'`). | N/A |
| `precio_referencial` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Precio sugerido de venta en mostrador. | N/A |
| `portada_url` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Ruta local o URL remota de la carátula. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |

---

### 2.3 Tabla: `sesiones_caja`
- **Descripción funcional:** Control de turno o jornada diaria de caja en el mostrador.
- **Persistencia:** Replicada.

| Campo | Tipo PG | Tipo SQLite | Nulo | Clave / Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador de la sesión de caja. | N/A |
| `usuario_apertura_id`| `UUID` | `TEXT` | No | FK | N/A | Usuario que apertura la caja. | `usuarios.id` |
| `usuario_cierre_id` | `UUID` | `TEXT` | Sí | FK | `NULL` | Usuario que ejecuta el arqueo de cierre. | `usuarios.id` |
| `monto_inicial` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Fondo inicial de sencillo en efectivo. | N/A |
| `monto_final_calculado`|`NUMERIC(10,2)`|`REAL`| Sí | N/A | `0.00` | Total teórico esperado en caja según ventas. | N/A |
| `monto_final_declarado`|`NUMERIC(10,2)`|`REAL`| Sí | N/A | `NULL` | Total físico contado durante el arqueo. | N/A |
| `diferencia` | `NUMERIC(10,2)`| `REAL` | Sí | N/A | `0.00` | Discrepancia (`declarado - calculado`). | N/A |
| `estado_caja` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'abierta'` | `'abierta'`, `'cierre_provisorio_offline'`, `'cerrada_conciliada'`. | N/A |
| `fecha_apertura` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha y hora de apertura. | N/A |
| `fecha_cierre` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Fecha y hora de cierre. | N/A |

---

### 2.4 Tabla: `ventas`
- **Descripción funcional:** Cabecera de transacción comercial en mostrador.
- **Persistencia:** Replicada.

| Campo | Tipo PG | Tipo SQLite | Nulo | Clave / Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único de la venta. | N/A |
| `sesion_caja_id` | `UUID` | `TEXT` | No | FK | N/A | Sesión de caja en que se originó. | `sesiones_caja.id`|
| `vendedor_id` | `UUID` | `TEXT` | No | FK | N/A | Empleado que registró la venta. | `usuarios.id` |
| `autorizador_id` | `UUID` | `TEXT` | Sí | FK | `NULL` | Dueño/Admin que autorizó fiado. | `usuarios.id` |
| `cliente_nombre` | `VARCHAR(150)` | `TEXT` | Sí | N/A | `NULL` | Nombre del cliente (obligatorio si fiado).| N/A |
| `cliente_documento` | `VARCHAR(30)` | `TEXT` | Sí | N/A | `NULL` | DNI o teléfono del cliente. | N/A |
| `total_bruto` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Suma de precios de lista. | N/A |
| `total_descuentos` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Descuento total aplicado. | N/A |
| `total_neto` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Monto final a cobrar (`bruto - descuento`).| N/A |
| `total_pagado` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Suma de abonos registrados. | N/A |
| `saldo_pendiente` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Deuda restante (`neto - pagado`). | N/A |
| `estado_venta` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'borrador'` | `'borrador'`, `'completada'`, `'pendiente_regularizacion'`, etc. | N/A |
| `estado_pago` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'pendiente'`| `'pendiente'`, `'parcial'`, `'total'`, `'anulado'`. | N/A |
| `estado_entrega` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'retenido'` | `'retenido'`, `'entregado_total'`, `'entregado_saldo_pendiente'`. | N/A |
| `es_venta_rapida` | `BOOLEAN` | `INTEGER` | No | N/A | `FALSE` | Marca de venta rápida con foto. | N/A |
| `foto_comprobante_url`| `TEXT` | `TEXT` | Sí | N/A | `NULL` | Foto de respaldo de venta rápida. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha y hora de emisión. | N/A |
| `sync_status` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'pending'` | Estado de sincronización local. | N/A |

---

### 2.5 Tabla: `venta_detalles`
- **Descripción funcional:** Renglones o ítems asociados a una venta.
- **Persistencia:** Replicada.

| Campo | Tipo PG | Tipo SQLite | Nulo | Clave / Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del detalle. | N/A |
| `venta_id` | `UUID` | `TEXT` | No | FK | N/A | Venta a la que pertenece. | `ventas.id` |
| `edicion_libro_id` | `UUID` | `TEXT` | Sí | FK | `NULL` | Edición vendida (null si venta rápida).| `ediciones_libro.id`|
| `descripcion_item` | `VARCHAR(255)` | `TEXT` | No | NOT NULL | N/A | Glosa o título vendido. | N/A |
| `cantidad` | `INTEGER` | `INTEGER` | No | CHECK (> 0) | `1` | Número de ejemplares vendidos. | N/A |
| `precio_unitario` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Precio acordado por unidad. | N/A |
| `descuento` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Descuento aplicado al ítem. | N/A |
| `subtotal` | `NUMERIC(10,2)`| `REAL` | No | CHECK (>= 0) | `0.00` | Subtotal del renglón. | N/A |

---

### 2.6 Tabla: `pagos_venta`
- **Descripción funcional:** Registro de cobros y abonos aplicados a una venta.
- **Persistencia:** Replicada.

| Campo | Tipo PG | Tipo SQLite | Nulo | Clave / Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del pago. | N/A |
| `venta_id` | `UUID` | `TEXT` | No | FK | N/A | Venta amortizada. | `ventas.id` |
| `monto` | `NUMERIC(10,2)`| `REAL` | No | CHECK (> 0) | N/A | Importe abonado. | N/A |
| `medio_pago` | `VARCHAR(30)` | `TEXT` | No | CHECK | N/A | `'efectivo'`, `'tarjeta_pos'`, `'billetera_digital'`. | N/A |
| `referencia_pago` | `VARCHAR(100)` | `TEXT` | Sí | N/A | `NULL` | Nro. de operación o código POS. | N/A |
| `fecha_pago` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha y hora del abono. | N/A |

---

## 3. Reglas para la Actualización del Diccionario

1. **Inseparabilidad con Migraciones:** Ninguna migración DDL en Supabase o actualización de esquema en SQLite podrá comitearse sin actualizar previamente este documento.
2. **Registro de Nulabilidad y Valores por Defecto:** Se debe justificar explícitamente cualquier campo que admita valores nulos.
3. **Mantenimiento de Tipos Equivalentes:** Para cada nuevo campo se debe definir obligatoriamente su tipo nativo en PostgreSQL y su representación en SQLite (donde los tipos se mapean a `TEXT`, `INTEGER`, `REAL` o `BLOB`).
