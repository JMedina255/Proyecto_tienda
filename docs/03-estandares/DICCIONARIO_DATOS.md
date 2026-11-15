# Diccionario de Datos — Especificación y Catálogo Relacional (DICCIONARIO_DATOS.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda<br>
**Documento:** DICCIONARIO_DATOS.md<br>
**Estado:** Consolidado y Refinado en H04<br>
**Trazabilidad:** [../02-arquitectura/MODELO_DATOS.md](../02-arquitectura/MODELO_DATOS.md) | [../01-requerimientos/SRS.md](../01-requerimientos/SRS.md) | [../01-requerimientos/REGLAS_NEGOCIO.md](../01-requerimientos/REGLAS_NEGOCIO.md) | [../04-seguridad/HARDENING.md](../04-seguridad/HARDENING.md)

---

## 1. Convenciones Generales de Tipos y Datos

| Dominio de Dato | Tipo PostgreSQL | Tipo SQLite | Formato / Regla de Validación | Convención Técnica |
| :--- | :--- | :--- | :--- | :--- |
| **Identificadores (PK/FK)**| `UUID` | `TEXT` | UUID v4 (36 caracteres) | Generado en cliente (`crypto.randomUUID()`); default remoto `gen_random_uuid()`. |
| **Importes Monetarios** | `NUMERIC(12,2)` | `INTEGER` | Dos decimales exactos en PG (`>= 0.00`); céntimos enteros en SQLite (`>= 0`). | Prohibido coma flotante binario (`REAL`/`FLOAT`). PG: `CHECK(monto = ROUND(monto, 2))`. SQLite: céntimos enteros (ej. S/ 15.50 -> `1550`). Conversión: `PG = SQLite / 100.00`, `SQLite = CAST(ROUND(PG * 100) AS INTEGER)`. |
| **Marcas de Tiempo (UTC)** | `TIMESTAMPTZ` | `TEXT` | ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SS.SSSZ`) | Generado en UTC. Default remoto `timezone('utc', now())`. |
| **Fechas Comerciales** | `DATE` | `TEXT` | `YYYY-MM-DD` | Representa la jornada comercial independiente de zona horaria. |
| **Estados y Enums** | `VARCHAR(30)` | `TEXT` | Conjuntos cerrados en mayúsculas/snake_case | Validado con restricciones `CHECK(campo IN (...))` idénticas en PG y SQLite. |
| **Borrado Lógico** | `TIMESTAMPTZ` | `TEXT` | `NULL` = activo; fecha UTC = baja | Consultas estándar: `WHERE deleted_at IS NULL`. |
| **Idempotencia / Hashes** | `VARCHAR(64)` | `TEXT` | Cadena hexadecimal SHA-256 (64 chars) | `UNIQUE` en tablas receptoras y tabla de deduplicación. |

---

## 2. Dominio de Identidad, Acceso y Autorizaciones

### 2.1 `usuarios` (Replicada)
*Propósito:* Operadores del sistema con credenciales vinculadas a Supabase GoTrue.

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único del usuario. | N/A |
| `auth_id` | `UUID` | `TEXT` | Sí | UQ | `NULL` | ID vinculado a `auth.users` de Supabase. | `auth.users.id` |
| `rol` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'vendedor'` | `'admin'`, `'dueno'`, `'vendedor'`. | N/A |
| `nombre` | `VARCHAR(150)`| `TEXT` | No | NOT NULL | N/A | Nombre y apellidos del colaborador. | N/A |
| `email` | `VARCHAR(150)`| `TEXT` | No | UQ | N/A | Correo electrónico institucional/operativo.| N/A |
| `activo` | `BOOLEAN` | `INTEGER` | No | N/A | `TRUE` (1) | Estado de habilitación operativa. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación del registro. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de última modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Marca de baja lógica. | N/A |

### 2.2 `autorizaciones_override` (Replicada)
*Propósito:* Bitácora inmutable de autorizaciones supervisor (créditos fiados y anulaciones) ejecutadas online u offline (`RN-PAG-002`, `SEC-AUTHZ-004`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único de la autorización. | N/A |
| `operacion_tipo` | `VARCHAR(30)` | `TEXT` | No | CHECK | N/A | `'venta_fiada'`, `'anulacion_venta'`. | N/A |
| `entidad_id` | `UUID` | `TEXT` | No | INDEX | N/A | ID de la venta o transacción autorizada. | N/A |
| `autorizador_id` | `UUID` | `TEXT` | No | FK | N/A | Dueño o Administrador que autorizó. | `usuarios.id` |
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Hardware donde se registró el override. | N/A |
| `metodo` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'pin_local'` | `'pin_local'`, `'biometria'`, `'token_remoto'`.| N/A |
| `firma_hmac` | `VARCHAR(64)` | `TEXT` | No | NOT NULL | N/A | Hash criptográfico de la autorización. | N/A |
| `caducidad_at` | `TIMESTAMPTZ` | `TEXT` | No | NOT NULL | N/A | Límite temporal de validez de la credencial. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Momento exacto del override. | N/A |

### 2.3 `usuarios_sesion_local` (Exclusiva SQLite)
*Propósito:* Almacenar localmente el perfil y credencial hasheada para validación offline en terminales móviles.

| Campo | Tipo SQLite | Nulo | Restricción | Descripción |
| :--- | :--- | :---: | :--- | :--- |
| `usuario_id` | `TEXT` | No | PK / FK | Identificador del usuario autenticado. |
| `rol` | `TEXT` | No | CHECK | Rol verificado en el último inicio de sesión. |
| `pin_hash` | `TEXT` | No | NOT NULL | Hash argon2id/bcrypt del PIN numérico local. |
| `ultimo_login_at` | `TEXT` | No | NOT NULL | Marca de tiempo del último inicio de sesión exitoso. |
| `expiracion_offline_at`| `TEXT` | No | NOT NULL | Fecha límite del período de gracia offline ([DEC-017](../06-gestion/DECISIONES.md#dec-017-período-de-gracia-para-caducidad-de-sesiones-offline)). |

### 2.4 `credenciales_revocadas_local` (Exclusiva SQLite)
*Propósito:* Lista de revocación local (CRL) para denegar autorizaciones offline a usuarios deshabilitados.

| Campo | Tipo SQLite | Nulo | Restricción | Descripción |
| :--- | :--- | :---: | :--- | :--- |
| `usuario_id` | `TEXT` | No | PK | Identificador del usuario revocado o dado de baja. |
| `revocado_at` | `TEXT` | No | NOT NULL | Fecha y hora en que se revocaron sus privilegios. |
| `motivo` | `TEXT` | Sí | N/A | Causa de revocación (ej. despido, robo de terminal). |

---

## 3. Dominio de Catálogo Bibliográfico

### 3.1 `categorias` (Replicada)
*Propósito:* Clasificación temática y géneros del catálogo (`RN-CAT-005`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador de la categoría. | N/A |
| `nombre` | `VARCHAR(100)`| `TEXT` | No | UQ | N/A | Nombre (ej. Literatura, Filosofía). | N/A |
| `codigo` | `VARCHAR(20)` | `TEXT` | Sí | UQ | `NULL` | Código mnemotécnico o Dewey abreviado. | N/A |
| `descripcion` | `VARCHAR(255)`| `TEXT` | Sí | N/A | `NULL` | Alcance de la sección temática. | N/A |
| `activo` | `BOOLEAN` | `INTEGER` | No | N/A | `TRUE` | Estado de vigencia en mostrador. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |

### 3.2 `libros` (Replicada)
*Propósito:* Obra intelectual a nivel título genérico ([DEC-004](../06-gestion/DECISIONES.md#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación)).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador universal del libro matriz. | N/A |
| `titulo` | `VARCHAR(255)`| `TEXT` | No | INDEX | N/A | Título completo de la obra. | N/A |
| `autor` | `VARCHAR(255)`| `TEXT` | No | INDEX | N/A | Autor principal, creador o compilador. | N/A |
| `editorial` | `VARCHAR(150)`| `TEXT` | Sí | INDEX | `NULL` | Editorial referencial de la obra. | N/A |
| `isbn_referencial`| `VARCHAR(20)`| `TEXT`| Sí | INDEX | `NULL` | Código normalizado ISBN-10/13 de referencia.| N/A |
| `sinopsis` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Resumen o texto informativo del libro. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de registro. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de última edición. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |

### 3.3 `libro_categoria` (Replicada)
*Propósito:* Tabla asociativa N a M entre títulos y categorías temáticas.

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador de la relación. | N/A |
| `libro_id` | `UUID` | `TEXT` | No | FK | N/A | Obra bibliográfica. | `libros.id` |
| `categoria_id` | `UUID` | `TEXT` | No | FK | N/A | Categoría asignada. | `categorias.id` |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de asignación. | N/A |
*(Restricción UQ compuesta: `UNIQUE(libro_id, categoria_id)`).*

### 3.4 `ediciones_libro` (Replicada)
*Propósito:* Variante física comercializable, formato y condición física de un libro (`RN-CAT-001`, `RN-CAT-002`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único de la edición física. | N/A |
| `libro_id` | `UUID` | `TEXT` | No | FK | N/A | Libro matriz. | `libros.id` |
| `isbn` | `VARCHAR(20)` | `TEXT` | Sí | INDEX | `NULL` | ISBN exacto de esta edición/impresión. | N/A |
| `edicion` | `VARCHAR(100)`| `TEXT` | Sí | N/A | `'Estándar'` | Denominación (ej. 1ra ed., Conmemorativa).| N/A |
| `anio` | `INTEGER` | `INTEGER` | Sí | CHECK (>1500) | `NULL` | Año de publicación de la edición. | N/A |
| `formato` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'tapa_blanda'`| `'tapa_blanda'`, `'tapa_dura'`, `'bolsillo'`, `'otro'`. | N/A |
| `estado_conservacion`|`VARCHAR(20)`|`TEXT`| No | CHECK | `'nuevo'` | `'nuevo'`, `'usado'`. | N/A |
| `precio_referencial`|`NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Precio de mostrador orientativo (en céntimos en SQLite). | N/A |
| `portada_url` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Path o URL de imagen de portada. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |

---

## 4. Dominio de Proveedores y Compras

### 4.1 `proveedores` (Replicada)
*Propósito:* Directorio de editoriales, distribuidoras y particulares que abastecen libros.

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único del proveedor. | N/A |
| `nombre` | `VARCHAR(150)`| `TEXT` | No | UQ | N/A | Razón social o nombre comercial. | N/A |
| `contacto` | `VARCHAR(100)`| `TEXT` | Sí | N/A | `NULL` | Persona de contacto o asesor comercial. | N/A |
| `telefono` | `VARCHAR(30)` | `TEXT` | Sí | N/A | `NULL` | Teléfono de contacto. | N/A |
| `whatsapp` | `VARCHAR(30)` | `TEXT` | Sí | N/A | `NULL` | Número de WhatsApp para pedidos rápidos. | N/A |
| `email` | `VARCHAR(150)`| `TEXT` | Sí | N/A | `NULL` | Correo electrónico comercial. | N/A |
| `direccion` | `VARCHAR(255)`| `TEXT` | Sí | N/A | `NULL` | Domicilio o almacén de distribución. | N/A |
| `especialidades`| `TEXT` | `TEXT` | Sí | N/A | `NULL` | Líneas temáticas o editoriales de especialidad.| N/A |
| `activo` | `BOOLEAN` | `INTEGER` | No | N/A | `TRUE` | Vigencia de la relación comercial. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de registro. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |

### 4.2 `cuentas_bancarias_proveedor` (Replicada)
*Propósito:* Resguardo de datos financieros y de abono cifrados con AES-256 (`RN-PRV-002`, `SEC-DAT-001`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único de la cuenta. | N/A |
| `proveedor_id` | `UUID` | `TEXT` | No | FK | N/A | Proveedor titular de la cuenta. | `proveedores.id`|
| `banco` | `VARCHAR(100)`| `TEXT` | No | NOT NULL | N/A | Entidad bancaria o billetera receptora. | N/A |
| `tipo_cuenta` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'corriente'` | `'corriente'`, `'ahorros'`, `'cci'`, `'billetera'`.| N/A |
| `numero_cuenta_cifrado`| `TEXT`| `TEXT` | No | NOT NULL | N/A | Cifrado con clave AES-256 en Keystore. | N/A |
| `titular_cifrado` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Nombre del titular cifrado. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de alta. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |

### 4.3 `libro_proveedor` (Replicada)
*Propósito:* Matriz N a M de cotización y costos de adquisición variables por edición ([DEC-005](../06-gestion/DECISIONES.md#dec-005-relación-muchos-a-muchos-entre-libros-y-proveedores-con-costos-variables)).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador de la cotización. | N/A |
| `edicion_libro_id` | `UUID` | `TEXT` | No | FK | N/A | Edición de libro suministrada. | `ediciones_libro.id`|
| `proveedor_id` | `UUID` | `TEXT` | No | FK | N/A | Proveedor ofertante. | `proveedores.id`|
| `costo_referencial`|`NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Costo estimado de compra (en céntimos en SQLite).| N/A |
| `codigo_proveedor`| `VARCHAR(50)` | `TEXT` | Sí | N/A | `NULL` | Código interno SKU del distribuidor. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de registro. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de actualización. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |
*(Restricción UQ compuesta: `UNIQUE(edicion_libro_id, proveedor_id)`).*

### 4.4 `pedidos_proveedor` (Replicada)
*Propósito:* Órdenes de abastecimiento y pedidos de faltantes con proveedor asignable a posteriori (`RN-PED-001`, `RN-PED-002`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único del pedido. | N/A |
| `proveedor_id` | `UUID` | `TEXT` | Sí | FK | `NULL` | Proveedor asignado (null si faltante abierto).| `proveedores.id`|
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Terminal donde se originó el pedido. | N/A |
| `usuario_id` | `UUID` | `TEXT` | No | FK | N/A | Colaborador que registró la orden. | `usuarios.id` |
| `estado_pedido` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'borrador_sin_asignar'` | `'borrador_sin_asignar'`, `'asignado'`, `'enviado'`, `'recepcion_parcial'`, `'recibido_total'`, `'cancelado'`. | N/A |
| `total_estimado` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Valor proyectado de la compra (en céntimos en SQLite).| N/A |
| `total_recibido` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Valor liquidado de mercadería recibida (en céntimos en SQLite).| N/A |
| `total_abonado` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Suma de pagos efectuados al proveedor (en céntimos en SQLite).| N/A |
| `saldo_deuda` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Deuda pendiente (`total_recibido - total_abonado`, en céntimos).| N/A |
| `fecha_solicitud`| `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de alta del pedido. | N/A |
| `fecha_estimada` | `DATE` | `TEXT` | Sí | N/A | `NULL` | Fecha comprometida de despacho/llegada. | N/A |
| `observaciones` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Notas de coordinación comercial. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de última modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |

### 4.5 `pedido_detalles` (Replicada)
*Propósito:* Renglones del pedido. Soporta libros catalogados y pedidos libres con foto (`RN-PED-003`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del detalle. | N/A |
| `pedido_id` | `UUID` | `TEXT` | No | FK | N/A | Pedido al que pertenece. | `pedidos_proveedor.id`|
| `edicion_libro_id`|`UUID` | `TEXT` | Sí | FK | `NULL` | Edición formal (null si no catalogado).| `ediciones_libro.id`|
| `descripcion_item`|`VARCHAR(255)`|`TEXT` | No | NOT NULL | N/A | Título o texto libre descriptivo. | N/A |
| `foto_referencia_url`|`TEXT` | `TEXT` | Sí | N/A | `NULL` | Foto de referencia para no catalogados. | N/A |
| `cantidad_solicitada`|`INTEGER` |`INTEGER`| No | CHECK(>0) | `1` | Ejemplares solicitados. | N/A |
| `cantidad_recibida`|`INTEGER` |`INTEGER`| No | CHECK(>=0) | `0` | Ejemplares entregados por el proveedor. | N/A |
| `costo_unitario` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Costo unitario acordado (en céntimos en SQLite).| N/A |
| `subtotal` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Subtotal pactado (`solicitada * costo`, en céntimos).| N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |

### 4.6 `recepciones_pedido` (Replicada)
*Propósito:* Registro de entregas y despachos parciales o totales de proveedores (`RN-PED-002`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador de la recepción. | N/A |
| `pedido_id` | `UUID` | `TEXT` | No | FK | N/A | Pedido asociado. | `pedidos_proveedor.id`|
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Dispositivo donde se registró la entrega. | N/A |
| `usuario_id` | `UUID` | `TEXT` | No | FK | N/A | Colaborador receptor. | `usuarios.id` |
| `numero_guia` | `VARCHAR(50)` | `TEXT` | Sí | N/A | `NULL` | Guía de remisión física o factura física.| N/A |
| `fecha_recepcion`| `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha física de recepción. | N/A |
| `observaciones` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Novedades o estado del paquete. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Registro de auditoría. | N/A |

### 4.7 `abonos_proveedor` (Replicada)
*Propósito:* Ledger inmutable append-only de pagos y transferencias a distribuidores (`RN-PRV-001`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único del abono. | N/A |
| `proveedor_id` | `UUID` | `TEXT` | No | FK | N/A | Proveedor receptor del pago. | `proveedores.id`|
| `pedido_id` | `UUID` | `TEXT` | Sí | FK | `NULL` | Pedido que amortiza (si aplica). | `pedidos_proveedor.id`|
| `sesion_caja_id`| `UUID` | `TEXT` | Sí | FK | `NULL` | Sesión de caja si el egreso fue en efectivo.| `sesiones_caja.id`|
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Terminal emisor. | N/A |
| `usuario_id` | `UUID` | `TEXT` | No | FK | N/A | Colaborador que ejecutó el desembolso. | `usuarios.id` |
| `monto` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>0) | N/A | Importe abonado (en céntimos en SQLite). | N/A |
| `medio_pago` | `VARCHAR(30)` | `TEXT` | No | CHECK | N/A | `'efectivo'`, `'transferencia_bancaria'`, `'pos'`.| N/A |
| `comprobante_url`| `TEXT` | `TEXT` | Sí | N/A | `NULL` | Foto de constancia o voucher bancario. | N/A |
| `idempotency_key`| `VARCHAR(64)` | `TEXT` | No | UQ | N/A | Clave de deduplicación. | N/A |
| `fecha_abono` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha valor del desembolso. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Registro inmutable en base de datos. | N/A |

---

## 5. Dominio de Tesorería y Caja

### 5.1 `sesiones_caja` (Replicada)
*Propósito:* Control del turno operativo de mostrador, arqueos y conciliación ([DEC-007](../06-gestion/DECISIONES.md#dec-007-soporte-de-cierres-de-caja-offline-provisionales-con-conciliación-posterior), [DEC-018](../06-gestion/DECISIONES.md#dec-018-política-de-exclusividad-de-sesión-de-caja-por-dispositivo)).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador de la sesión de caja. | N/A |
| `dispositivo_id` | `UUID` | `TEXT` | No | INDEX | N/A | Dispositivo físico exclusivo del turno. | N/A |
| `usuario_apertura_id`|`UUID` | `TEXT` | No | FK | N/A | Usuario que abrió el turno. | `usuarios.id` |
| `usuario_cierre_id`|`UUID` | `TEXT` | Sí | FK | `NULL` | Usuario que ejecutó el arqueo de cierre.| `usuarios.id` |
| `monto_inicial` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Fondo de sencillo en efectivo al abrir (en céntimos en SQLite).| N/A |
| `monto_final_calculado`|`NUMERIC(12,2)`|`INTEGER`| Sí| N/A | `0` (PG: `0.00`) | Total teórico esperado en caja según ledger (en céntimos en SQLite).| N/A |
| `monto_final_declarado`|`NUMERIC(12,2)`|`INTEGER`| Sí| N/A | `NULL` | Efectivo físico contado en arqueo (en céntimos en SQLite). | N/A |
| `diferencia` | `NUMERIC(12,2)`|`INTEGER`| Sí| N/A | `0` (PG: `0.00`) | Discrepancia (`declarado - calculado`, en céntimos en SQLite).| N/A |
| `estado_caja` | `VARCHAR(35)` | `TEXT` | No | CHECK | `'abierta'` | `'abierta'`, `'cierre_provisorio_offline'`, `'pendiente_conciliacion'`, `'conciliado_conforme'`, `'conciliado_con_diferencia'`. | N/A |
| `fecha_apertura` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha/hora de apertura. | N/A |
| `fecha_cierre` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Fecha/hora de arqueo y cierre en terminal.| N/A |
| `fecha_conciliacion`|`TIMESTAMPTZ`|`TEXT`| Sí | N/A | `NULL` | Fecha de validación por Administrador. | N/A |
| `usuario_conciliador_id`|`UUID` | `TEXT` | Sí | FK | `NULL` | Administrador que concilió el cierre. | `usuarios.id` |
| `idempotency_key`| `VARCHAR(64)` | `TEXT` | No | UQ | N/A | Clave de deduplicación de apertura/cierre.| N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Registro de auditoría. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Actualización de estado. | N/A |

### 5.2 `arqueos_detalle` (Replicada)
*Propósito:* Desglose del conteo físico del dinero al cierre de turno por cada medio de pago (`RN-CAJ-003`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del desglose. | N/A |
| `sesion_caja_id` | `UUID` | `TEXT` | No | FK | N/A | Sesión de caja auditada. | `sesiones_caja.id`|
| `medio_pago` | `VARCHAR(30)` | `TEXT` | No | CHECK | N/A | `'efectivo'`, `'tarjeta_pos'`, `'billetera_digital'`. | N/A |
| `monto_contado` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Saldo físico o voucher contado (en céntimos en SQLite).| N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de arqueo. | N/A |

### 5.3 `movimientos_caja` (Replicada)
*Propósito:* Libro mayor append-only de entradas y salidas de efectivo dentro de la sesión de caja activa (`RN-CAJ-002`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del movimiento. | N/A |
| `sesion_caja_id` | `UUID` | `TEXT` | No | FK | N/A | Turno de caja impactado. | `sesiones_caja.id`|
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Dispositivo físico emisor. | N/A |
| `usuario_id` | `UUID` | `TEXT` | No | FK | N/A | Colaborador ejecutor. | `usuarios.id` |
| `tipo_movimiento`| `VARCHAR(30)` | `TEXT` | No | CHECK | N/A | `'ingreso_venta'`, `'egreso_gasto'`, `'egreso_abono_proveedor'`, `'retiro_propietario'`, `'ingreso_extra'`, `'ajuste_sobrante'`, `'ajuste_faltante'`. | N/A |
| `monto` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>0) | N/A | Importe del movimiento en céntimos en positivo. | N/A |
| `medio_pago` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'efectivo'` | Medio de pago que afectó caja física. | N/A |
| `motivo` | `VARCHAR(255)`| `TEXT` | No | NOT NULL | N/A | Justificación comercial del flujo. | N/A |
| `referencia_tipo`| `VARCHAR(30)` | `TEXT` | Sí | N/A | `NULL` | `'venta'`, `'gasto'`, `'abono_proveedor'`. | N/A |
| `referencia_id` | `UUID` | `TEXT` | Sí | INDEX | `NULL` | ID del registro fuente causante del flujo.| N/A |
| `idempotency_key`| `VARCHAR(64)` | `TEXT` | No | UQ | N/A | Clave única de deduplicación. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Registro inmutable de auditoría. | N/A |

### 5.4 `gastos` (Replicada)
*Propósito:* Egresos operativos corrientes de la librería (alquiler, luz, agua, insumos) (`RN-GAS-001`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del gasto. | N/A |
| `sesion_caja_id` | `UUID` | `TEXT` | Sí | FK | `NULL` | Sesión de caja si afecta efectivo físico.| `sesiones_caja.id`|
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Dispositivo donde se registró. | N/A |
| `usuario_id` | `UUID` | `TEXT` | No | FK | N/A | Colaborador que registró el gasto. | `usuarios.id` |
| `categoria` | `VARCHAR(50)` | `TEXT` | No | CHECK | `'otros'` | `'alquiler'`, `'servicios_publicos'`, `'suministros'`, `'personal'`, `'mantenimiento'`, `'otros'`. | N/A |
| `monto` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>0) | N/A | Monto desembolsado en céntimos en SQLite. | N/A |
| `afecta_caja_efectivo`|`BOOLEAN`|`INTEGER`| No | N/A | `TRUE` | `TRUE`: descuenta efectivo en sesión de caja.| N/A |
| `comprobante_url`| `TEXT` | `TEXT` | Sí | N/A | `NULL` | Foto del ticket o factura física. | N/A |
| `descripcion` | `VARCHAR(255)`| `TEXT` | No | NOT NULL | N/A | Glosa descriptiva del gasto. | N/A |
| `idempotency_key`| `VARCHAR(64)` | `TEXT` | No | UQ | N/A | Clave única de deduplicación. | N/A |
| `fecha_gasto` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha del desembolso. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Registro de auditoría. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico. | N/A |

---

## 6. Dominio de Ventas y Cobros

### 6.1 `ventas` (Replicada)
*Propósito:* Cabecera de transacción comercial en mostrador (ventas normales y rápidas) (`RN-VTA-001`, `RN-VTA-002`, `RN-VTA-003`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador universal de la venta. | N/A |
| `sesion_caja_id` | `UUID` | `TEXT` | No | FK | N/A | Sesión de caja originaria. | `sesiones_caja.id`|
| `vendedor_id` | `UUID` | `TEXT` | No | FK | N/A | Colaborador que emitió la venta. | `usuarios.id` |
| `autorizador_id` | `UUID` | `TEXT` | Sí | FK | `NULL` | Supervisor que aprobó saldo fiado/anulación.| `usuarios.id` |
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Hardware donde se registró la venta. | N/A |
| `tipo_venta` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'normal'` | `'normal'`, `'rapida'`. | N/A |
| `serie` | `VARCHAR(10)` | `TEXT` | No | NOT NULL | `'NV01'` | Serie asignada al terminal móvil (ej. `'NV01'`, `'NV02'`). | N/A |
| `correlativo` | `INTEGER` | `INTEGER` | No | INDEX | N/A | Correlativo monotónico local (`UNIQUE(serie, correlativo)`).| N/A |
| `cliente_nombre` | `VARCHAR(150)`| `TEXT` | Sí | CHECK | `NULL` | Obligatorio si `saldo_pendiente > 0` (mín. 3 caracteres). | N/A |
| `cliente_documento`|`VARCHAR(30)` | `TEXT` | Sí | CHECK | `NULL` | Obligatorio si `saldo_pendiente > 0` (mín. 6 caracteres: DNI/tel).| N/A |
| `total_bruto` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Suma de precios referenciales (en céntimos en SQLite). | N/A |
| `total_descuentos`|`NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Descuento total aplicado (en céntimos en SQLite). | N/A |
| `total_neto` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Importe final a cobrar (`bruto - descuento`, en céntimos).| N/A |
| `total_pagado` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Suma acumulada de cobros registrados (en céntimos). | N/A |
| `saldo_pendiente`| `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Deuda restante (`total_neto - total_pagado`, en céntimos).| N/A |
| `estado_venta` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'completada'`| `'borrador'`, `'completada'`, `'pendiente_regularizacion'`, `'anulada'`. | N/A |
| `estado_pago` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'total'` | `'pendiente'`, `'parcial'`, `'total'`, `'anulado'`. | N/A |
| `estado_entrega` | `VARCHAR(30)` | `TEXT` | No | CHECK | `'entregado_total'`| `'retenido'`, `'entregado_total'`, `'entregado_saldo_pendiente'`. | N/A |
| `estado_regularizacion`|`VARCHAR(25)`|`TEXT`| No| CHECK | `'no_aplica'`| `'no_aplica'`, `'pendiente'`, `'completada'`. | N/A |
| `foto_soporte_url`| `TEXT` | `TEXT` | Sí | N/A | `NULL` | Foto de soporte en ventas rápidas. | N/A |
| `idempotency_key`| `VARCHAR(64)` | `TEXT` | No | UQ | N/A | Clave única de deduplicación de venta. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha y hora de emisión. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de última modificación. | N/A |
| `deleted_at` | `TIMESTAMPTZ` | `TEXT` | Sí | N/A | `NULL` | Borrado lógico (solo anulaciones). | N/A |

### 6.2 `venta_detalles` (Replicada)
*Propósito:* Renglones o ítems incluidos en la venta. Admite `edicion_libro_id NULL` transitoriamente en ventas rápidas (`RN-VTA-002`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del detalle. | N/A |
| `venta_id` | `UUID` | `TEXT` | No | FK | N/A | Venta a la que pertenece. | `ventas.id` |
| `edicion_libro_id`|`UUID` | `TEXT` | Sí | FK | `NULL` | Edición vendida (null si venta rápida pendiente). | `ediciones_libro.id`|
| `descripcion_item`|`VARCHAR(255)`|`TEXT` | No | NOT NULL | N/A | Glosa o título del libro vendido. | N/A |
| `cantidad` | `INTEGER` | `INTEGER` | No | CHECK(>0) | `1` | Ejemplares vendidos. | N/A |
| `precio_unitario`| `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Precio pactado en mostrador (en céntimos en SQLite).| N/A |
| `descuento` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Descuento acordado para el renglón (en céntimos).| N/A |
| `subtotal` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>=0) | `0` (PG: `0.00`) | Subtotal pactado (`cant * precio - desc`, en céntimos).| N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de creación. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de modificación. | N/A |

### 6.3 `pagos_venta` (Replicada)
*Propósito:* Ledger append-only de cobros y abonos aplicados a una venta (`RN-PAG-001`, `RN-PAG-003`).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador único del cobro. | N/A |
| `venta_id` | `UUID` | `TEXT` | No | FK | N/A | Venta amortizada. | `ventas.id` |
| `sesion_caja_id` | `UUID` | `TEXT` | No | FK | N/A | Sesión de caja activa donde ingresó el dinero.| `sesiones_caja.id`|
| `dispositivo_id` | `UUID` | `TEXT` | No | NOT NULL | N/A | Terminal que procesó el cobro. | N/A |
| `usuario_id` | `UUID` | `TEXT` | No | FK | N/A | Colaborador receptor. | `usuarios.id` |
| `monto` | `NUMERIC(12,2)`|`INTEGER`| No | CHECK(>0) | N/A | Importe cobrado (en céntimos en SQLite). | N/A |
| `medio_pago` | `VARCHAR(30)` | `TEXT` | No | CHECK | N/A | `'efectivo'`, `'tarjeta_pos'`, `'billetera_digital'`. | N/A |
| `referencia_pago`| `VARCHAR(100)`| `TEXT` | Sí | N/A | `NULL` | Código de operación POS o transferencia. | N/A |
| `idempotency_key`| `VARCHAR(64)` | `TEXT` | No | UQ | N/A | Clave única para evitar doble cobro. | N/A |
| `fecha_pago` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha y hora del cobro. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Inmutable en base de datos. | N/A |

---

## 7. Dominio de Multimedia, Sincronización y Auditoría

### 7.1 `archivos_multimedia` (Replicada)
*Propósito:* Registro de fotografías, hashes y referencias a buckets de Supabase Storage ([ARQUITECTURA.md §4.3](../02-arquitectura/ARQUITECTURA.md#43-almacenamiento-de-archivos-supabase-storage)).

| Campo | Tipo PG | Tipo SQLite | Nulo | Restricción | Defecto | Descripción | Relación |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `TEXT` | No | PK | UUID v4 | Identificador del archivo multimedia. | N/A |
| `entidad_tipo` | `VARCHAR(30)` | `TEXT` | No | CHECK | N/A | `'edicion_libro'`, `'venta_rapida'`, `'gasto'`, `'pedido'`. | N/A |
| `entidad_id` | `UUID` | `TEXT` | No | INDEX | N/A | ID del registro al que se adjunta la imagen. | N/A |
| `bucket` | `VARCHAR(50)` | `TEXT` | No | CHECK | N/A | `'book-covers'`, `'sales-quick-photos'`, `'expense-vouchers'`, `'supplier-receipts'`. | N/A |
| `path_remoto` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Ruta dentro del bucket de Supabase Storage. | N/A |
| `uri_local` | `TEXT` | `TEXT` | Sí | N/A | `NULL` | Ruta en sistema de archivos privado Android. | N/A |
| `hash_sha256` | `VARCHAR(64)` | `TEXT` | No | NOT NULL | N/A | Hash para verificación de integridad física. | N/A |
| `tamano_bytes` | `INTEGER` | `INTEGER` | No | CHECK(>0) | N/A | Peso del archivo en disco. | N/A |
| `mime_type` | `VARCHAR(50)` | `TEXT` | No | CHECK | `'image/jpeg'`| `'image/jpeg'`, `'image/png'`, `'image/webp'`.| N/A |
| `sync_status` | `VARCHAR(20)` | `TEXT` | No | CHECK | `'pending'` | `'pending'`, `'uploaded'`, `'failed'`. | N/A |
| `created_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Fecha de captura. | N/A |
| `updated_at` | `TIMESTAMPTZ` | `TEXT` | No | N/A | UTC Now | Actualización de subida. | N/A |

### 7.2 `sync_outbox` (Exclusiva SQLite)
*Propósito:* Cola local de mutaciones pendientes de envío hacia Supabase ([ARQUITECTURA.md §6.2](../02-arquitectura/ARQUITECTURA.md#62-patrón-outbox-y-estructura-de-mutaciones-locales)).

| Campo | Tipo SQLite | Nulo | Restricción | Defecto | Descripción |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `TEXT` | No | PK | UUID v4 | Identificador de la mutación. |
| `entity_type` | `TEXT` | No | CHECK | N/A | `'ventas'`, `'pagos_venta'`, `'sesiones_caja'`, `'gastos'`, `'libros'`, etc. |
| `entity_id` | `TEXT` | No | NOT NULL | N/A | UUID del registro impactado. |
| `operation` | `TEXT` | No | CHECK | N/A | `'INSERT'`, `'UPDATE'`, `'DELETE'`, `'TRANS_VENTA'`, `'CIERRE_CAJA'`. |
| `payload` | `TEXT` | No | NOT NULL | N/A | Datos serializados en formato JSON. |
| `idempotency_key`| `TEXT` | No | UQ | N/A | Hash SHA-256 único de la mutación. |
| `status` | `TEXT` | No | CHECK | `'pending'` | `'pending'`, `'in_progress'`, `'failed'`, `'synced'`. |
| `retry_count` | `INTEGER` | No | N/A | `0` | Contador de reintentos fallidos. |
| `last_error` | `TEXT` | Sí | N/A | `NULL` | Mensaje de error devuelto por el servidor. |
| `created_at` | `TEXT` | No | N/A | UTC Now | Fecha y hora UTC de creación en terminal. |

### 7.3 `sync_processed_mutations` (Exclusiva PostgreSQL)
*Propósito:* Tabla central en Supabase para control de idempotencia y descarte de reintentos duplicados.

| Campo | Tipo PG | Nulo | Restricción | Defecto | Descripción |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `UUID` | No | PK | `gen_random_uuid()` | Identificador de auditoría. |
| `idempotency_key`| `VARCHAR(64)` | No | UQ / INDEX | N/A | Clave enviada por el cliente. |
| `dispositivo_id` | `UUID` | No | NOT NULL | N/A | Terminal emisor. |
| `usuario_id` | `UUID` | No | FK | N/A | Usuario que ejecutó la operación. |
| `entity_type` | `VARCHAR(50)` | No | NOT NULL | N/A | Tabla afectada. |
| `entity_id` | `UUID` | No | NOT NULL | N/A | Registro afectado. |
| `operation` | `VARCHAR(30)` | No | NOT NULL | N/A | Operación aplicada. |
| `processed_at` | `TIMESTAMPTZ` | No | N/A | `now()` | Momento de procesamiento central. |

### 7.4 `auditoria_financiera` (Exclusiva PostgreSQL)
*Propósito:* Bitácora inmutable central de auditoría forense financiera (`SEC-AUD-001`).

| Campo | Tipo PG | Nulo | Restricción | Defecto | Descripción |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `UUID` | No | PK | `gen_random_uuid()` | Identificador del evento forense. |
| `entidad_tipo` | `VARCHAR(30)` | No | NOT NULL | N/A | `'venta'`, `'pago'`, `'caja_movimiento'`, `'gasto'`, `'abono_proveedor'`. |
| `entidad_id` | `UUID` | No | INDEX | N/A | UUID del registro financiero. |
| `dispositivo_id` | `UUID` | No | NOT NULL | N/A | Terminal que originó el cambio. |
| `usuario_id` | `UUID` | No | FK | N/A | Operador responsable. |
| `tipo_evento` | `VARCHAR(30)` | No | CHECK | N/A | `'CREACION'`, `'AMORTIZACION'`, `'ANULACION'`, `'CONCILIACION_DISCREPANCIA'`. |
| `monto_impactado` | `NUMERIC(12,2)`| No | NOT NULL | N/A | Importe económico afectado. |
| `balance_resultante`|`NUMERIC(12,2)`| No | NOT NULL | N/A | Saldo resultante tras el evento. |
| `metadata_json` | `JSONB` | No | NOT NULL | `'{}'` | Snapshot de datos y contexto de la operación. |
| `created_at` | `TIMESTAMPTZ` | No | N/A | `now()` | Fecha y hora UTC del servidor. |

---

## 8. Matriz de Integridad y Restricciones Financieras

Para garantizar la coherencia matemática y prevenir fraudes o descalces en modo offline y central:

| Restricción / Regla de Negocio | Nivel de BD | Definición de Integridad / Constraint | Justificación de Integridad |
| :--- | :---: | :--- | :--- |
| **Prevención de pagos duplicados** | PG / SQLite | `UNIQUE(idempotency_key)` en `pagos_venta` y `sync_outbox`. | Evita que una reconexión de red genere doble cobro. |
| **No saldos negativos en ventas** | PG / SQLite | `CHECK(saldo_pendiente >= 0.00)` y `CHECK(total_pagado >= 0.00)` | Impide inconsistencias aritméticas en cobranzas. |
| **Importes de cobro estrictamente positivos**| PG / SQLite | `CHECK(monto > 0.00)` en `pagos_venta` y `abonos_proveedor`. | Bloquea pagos en cero o negativos. |
| **Trazabilidad obligatoria de ventas**| PG / SQLite | `sesion_caja_id NOT NULL`, `vendedor_id NOT NULL`, `dispositivo_id NOT NULL`. | Ninguna venta puede emitirse sin turno ni responsable. |
| **Abono no excede deuda pendiente** | Lógica / RPC | `CHECK(monto <= saldo_pendiente)` validado en servicio de dominio y RPC. | Bloquea sobrepagos ciegos; diferencias van a saldo a favor. |
| **Exclusividad de autorización en fiados** | PG / SQLite | Si `estado_entrega = 'entregado_saldo_pendiente'`, exige `autorizador_id NOT NULL`. | Cumple obligatoriamente `RN-PAG-002`. |
| **Desglose de arqueo no negativo** | PG / SQLite | `CHECK(monto_contado >= 0.00)` en `arqueos_detalle`. | Evita conteos físicos anómalos al cierre de caja. |
| **Inmutabilidad de pagos** | RLS / Triggers| Prohibición de `UPDATE` y `DELETE` en `pagos_venta` y `movimientos_caja`. | Garantiza libro mayor auditable (*append-only*). |
| **Moneda entera en SQLite y decimal en PG**| PG / SQLite | SQLite `INTEGER` (céntimos) / PG `NUMERIC(12,2)` (`SQLite = ROUND(PG*100)`).| Elimina errores de redondeo de punto flotante IEEE 754. |
| **Identificación obligatoria en clientes fiados**| PG / SQLite | `CHECK(saldo_pendiente = 0 OR (cliente_nombre IS NOT NULL AND cliente_documento IS NOT NULL))` | Evita deudas anónimas y garantiza trazabilidad de cobranza (`RN-VTA-003`). |
| **Unicidad de serie y correlativo multi-terminal**| PG / SQLite | `UNIQUE(serie, correlativo)` en cabecera `ventas`. | Permite numeración offline autónoma sin colisión entre terminales. |
| **Protección contra sobrepagos concurrentes**| RPC / SQLite | Bloqueo `FOR UPDATE` en Supabase y `BEGIN IMMEDIATE` en SQLite validando saldo. | Impide que dos cobros simultáneos superen la deuda neta de una venta. |
