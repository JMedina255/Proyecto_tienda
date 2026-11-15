# Reglas de Negocio y Políticas Operativas (REGLAS_NEGOCIO.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda<br>
**Documento:** REGLAS_NEGOCIO.md<br>
**Estado:** Consolidado y Refinado en H01<br>
**Trazabilidad:** [SRS.md](SRS.md) | [../06-gestion/DECISIONES.md](../06-gestion/DECISIONES.md)<br>
**Total de Reglas de Negocio:** 26 reglas catalogadas (18 confirmadas originales + 8 reglas complementarias refinadas en H01).

---

## 1. Índice Maestro de Reglas de Negocio (RN)

| ID | Nombre de la Regla | Dominio Operativo | Decisión Asociada | Naturaleza |
| :--- | :--- | :--- | :---: | :---: |
| **RN-ALC-001** | Alcance de tienda única | 1.1 Alcance e Inventario | [DEC-001](../06-gestion/DECISIONES.md#dec-001-alcance-inicial-restringido-a-tienda-única) | **Confirmada** |
| **RN-STK-001** | Catálogo referencial sin bloqueo de stock | 1.1 Alcance e Inventario | [DEC-003](../06-gestion/DECISIONES.md#dec-003-catálogo-referencial-sin-control-cuantitativo-estricto-de-stock-en-mvp) | **Confirmada** |
| **RN-CAT-001** | Diferenciación por edición y estado de conservación | 1.2 Catálogo y Ediciones | [DEC-004](../06-gestion/DECISIONES.md#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación) | **Confirmada** |
| **RN-CAT-002** | Relación multi-proveedor con costos variables | 1.2 Catálogo y Ediciones | [DEC-005](../06-gestion/DECISIONES.md#dec-005-relación-muchos-a-muchos-entre-libros-y-proveedores-con-costos-variables) | **Confirmada** |
| **RN-CAT-003** | Validación humana de captura OCR | 1.2 Catálogo y Ediciones | [DEC-010](../06-gestion/DECISIONES.md#dec-010-captura-asistida-de-libros-mediante-fotografía-y-ocr) | **Confirmada** |
| **RN-CAT-004** | Registro sin ISBN y control de duplicidad | 1.2 Catálogo y Ediciones | Propuesta H01 | **Confirmada** |
| **RN-CAT-005** | Clasificación temática por categorías | 1.2 Catálogo y Ediciones | Propuesta H01 | **Confirmada** |
| **RN-VTA-001** | Flexibilidad de precios y descuentos en mostrador | 1.3 Ventas y Mostrador | N/A (Operación) | **Confirmada** |
| **RN-VTA-002** | Venta rápida y regularización obligatoria | 1.3 Ventas y Mostrador | [DEC-011](../06-gestion/DECISIONES.md#dec-011-modalidad-de-venta-rápida-con-foto-y-detalle-pendiente-de-completar) | **Confirmada** |
| **RN-VTA-003** | Anulación de ventas y restitución de caja | 1.3 Ventas y Mostrador | N/A (Auditoría) | **Confirmada** |
| **RN-VTA-004** | Límite máximo de descuento para Vendedores | 1.3 Ventas y Mostrador | [DEC-016](../06-gestion/DECISIONES.md#dec-016-política-de-descuentos-máximos-delegados) | **Propuesta** |
| **RN-PAG-001** | Multiplicidad y combinación de medios de pago | 1.4 Pagos y Cobranzas | N/A (Operación) | **Confirmada** |
| **RN-PAG-002** | Autorización obligatoria para entregas con saldo (Fiado) | 1.4 Pagos y Cobranzas | [DEC-006](../06-gestion/DECISIONES.md#dec-006-autorización-de-entrega-con-saldo-pendiente-de-cobro-fiado) | **Confirmada** |
| **RN-PAG-003** | Amortización de saldos pendientes deudores | 1.4 Pagos y Cobranzas | N/A (Cobranzas) | **Confirmada** |
| **RN-PAG-004** | Anticipos con mercadería retenida (Reserva) | 1.4 Pagos y Cobranzas | Propuesta H01 | **Confirmada** |
| **RN-CAJ-001** | Obligatoriedad de sesión de caja activa | 1.5 Caja y Egresos | N/A (Tesorería) | **Confirmada** |
| **RN-CAJ-002** | Cierres provisionales offline y conciliación remota | 1.5 Caja y Egresos | [DEC-007](../06-gestion/DECISIONES.md#dec-007-soporte-de-cierres-de-caja-offline-provisionales-con-conciliación-posterior) | **Confirmada** |
| **RN-CAJ-003** | Declaración física obligatoria por medio de pago | 1.5 Caja y Egresos | Propuesta H01 | **Confirmada** |
| **RN-GAS-001** | Imputación y respaldo de gastos operativos | 1.5 Caja y Egresos | N/A (Tesorería) | **Confirmada** |
| **RN-PRV-001** | Cuentas corrientes y abonos a proveedores | 1.6 Proveedores y Pedidos| N/A (Compras) | **Confirmada** |
| **RN-PRV-002** | Protección de datos bancarios de proveedores | 1.6 Proveedores y Pedidos| [SEC-AUTHZ-002](../04-seguridad/HARDENING.md) | **Confirmada** |
| **RN-PRV-003** | Especialidad temática y contacto por WhatsApp | 1.6 Proveedores y Pedidos| Propuesta H01 | **Confirmada** |
| **RN-PED-001** | Ciclo de pedidos de faltantes sin proveedor inicial | 1.6 Proveedores y Pedidos| N/A (Compras) | **Confirmada** |
| **RN-PED-002** | Recepciones parciales y saldos pendientes de entrega | 1.6 Proveedores y Pedidos| N/A (Compras) | **Confirmada** |
| **RN-PED-003** | Pedidos de libros no catalogados por foto/texto libre | 1.6 Proveedores y Pedidos| Propuesta H01 | **Confirmada** |
| **RN-FAC-001** | Emisión de notas internas de venta en MVP | 1.7 Facturación | [DEC-008](../06-gestion/DECISIONES.md#dec-008-exclusión-de-facturación-electrónica-en-mvp-con-diseño-extensible) | **Confirmada** |
| **RN-OFF-001** | Restricciones y operaciones autorizadas en modo offline | 1.8 Operación Offline | [DEC-009](../06-gestion/DECISIONES.md#dec-009-arquitectura-offline-first-con-sqlite-local-y-supabase-remoto) | **Confirmada** |

---

## 2. Especificación Detallada de Reglas de Negocio

### 2.1 Alcance e Inventario
- **RN-ALC-001 (Alcance de tienda única):**
  - Todas las operaciones comerciales, de caja, compras y reportes corresponden a una única sede física.
  - El sistema no contemplará transferencias entre almacenes ni particionado multisede durante la fase MVP (ref: [DEC-001](../06-gestion/DECISIONES.md#dec-001-alcance-inicial-restringido-a-tienda-única)).
- **RN-STK-001 (Catálogo referencial sin bloqueo de stock):**
  - El catálogo opera como una guía referencial de títulos y precios.
  - El sistema **nunca bloqueará** el registro de una venta ni la emisión de un comprobante por ausencia de stock cuantitativo registrado en base de datos.
  - La verificación de existencia física del libro es responsabilidad exclusiva del personal de mostrador (ref: [DEC-003](../06-gestion/DECISIONES.md#dec-003-catálogo-referencial-sin-control-cuantitativo-estricto-de-stock-en-mvp)).

### 2.2 Catálogo, Categorías y Ediciones
- **RN-CAT-001 (Diferenciación por edición y estado de conservación):**
  - Un mismo título bibliográfico (`libros`) puede desglosarse en múltiples ediciones físicas (`ediciones_libro`), diferenciadas por editorial, año, formato (tapa blanda, tapa dura, bolsillo) y estado de conservación (`Nuevo` o `Usado`).
  - Cada combinación posee su propio precio de venta referencial y costos de adquisición independientes (ref: [DEC-004](../06-gestion/DECISIONES.md#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación)).
- **RN-CAT-002 (Relación multi-proveedor con costos variables):**
  - Una edición de libro puede estar vinculada a múltiples proveedores. Para cada proveedor se almacena el costo de adquisición pactado, el código de catálogo del proveedor y la fecha del último suministro (ref: [DEC-005](../06-gestion/DECISIONES.md#dec-005-relación-muchos-a-muchos-entre-libros-y-proveedores-con-costos-variables)).
- **RN-CAT-003 (Validación humana de captura OCR):**
  - Ningún registro bibliográfico extraído mediante la cámara u OCR se persistirá en el catálogo con estado activo sin la previa confirmación o rectificación manual de los campos por un usuario autenticado (ref: [DEC-010](../06-gestion/DECISIONES.md#dec-010-captura-asistida-de-libros-mediante-fotografía-y-ocr)).
- **RN-CAT-004 (Registro sin ISBN y control de duplicidad):**
  - Se permite el registro de libros que carezcan de código ISBN (libros antiguos, de segunda mano, publicaciones independientes o escolares).
  - En caso de registrar un libro con ISBN, el sistema validará la unicidad del código.
  - Si no posee ISBN, el sistema aplicará un algoritmo de similitud sobre la concatenación normalizada de `título` + `autor principal`. En caso de coincidencia superior al 85%, alertará al usuario sobre posible duplicidad antes de guardar.
- **RN-CAT-005 (Clasificación temática por categorías):**
  - Todo libro debe pertenecer como mínimo a una **Categoría Principal** (ej. Literatura, Ciencias, Infantil, Derecho, Autoayuda).
  - Opcionalmente, podrá etiquetarse con subcategorías o temas secundarios para optimizar el filtrado de búsqueda en mostrador.

### 2.3 Ventas y Mostrador
- **RN-VTA-001 (Flexibilidad de precios y descuentos en mostrador):**
  - El precio referencial es modificable en mostrador para facilitar ofertas, liquidaciones o acuerdos directos con el cliente.
  - El descuento total aplicado a una venta no puede superar el 100% del valor bruto (el total neto a pagar no puede ser negativo).
- **RN-VTA-002 (Venta rápida y regularización obligatoria):**
  - En momentos de alta afluencia, el vendedor puede registrar una venta rápida ingresando únicamente el monto total cobrado, el medio de pago y una fotografía del lote de libros o comprobante.
  - La transacción queda registrada con `estado_venta = 'pendiente_regularizacion'`.
  - El ingreso dinerario impacta de inmediato en la sesión de caja activa.
  - **Restricción de Cierre:** El sistema emitirá una alerta bloqueante (o de advertencia estricta para rol Dueño/Admin) que exige desglosar los títulos vendidos antes de consolidar el cierre definitivo de caja del día (ref: [DEC-011](../06-gestion/DECISIONES.md#dec-011-modalidad-de-venta-rápida-con-foto-y-detalle-pendiente-de-completar)).
- **RN-VTA-003 (Anulación de ventas y restitución de caja):**
  - Solo los usuarios con rol `Dueño` o `Administrador` tienen potestad para anular una venta registrada.
  - Toda anulación exige ingresar un motivo justificado (mínimo 10 caracteres) y revierte automáticamente los ingresos en efectivo en la caja activa mediante un contra-movimiento de egreso auditable.
- **RN-VTA-004 (Límite máximo de descuento para Vendedores):**
  - *(Propuesta en evaluación [DEC-016](../06-gestion/DECISIONES.md#dec-016-política-de-descuentos-máximos-delegados)):* Un usuario con rol `Vendedor` solo puede aplicar hasta un 15% de descuento sobre el precio referencial por iniciativa propia. Descuentos superiores o modificaciones de precio que reduzcan el valor en más de 15% exigen autorización por PIN del `Dueño` o `Administrador`.

### 2.4 Pagos, Cobranzas y Créditos
- **RN-PAG-001 (Multiplicidad y combinación de medios de pago):**
  - Se admiten transacciones de pago fraccionadas mediante:
    1. `Efectivo` (con cálculo automático de vuelto o cambio).
    2. `Billetera Digital` (Yape, Plin, transferencia bancaria inmediata, con captura de número de operación).
    3. `Tarjeta POS` (tarjeta de débito/crédito procesada en terminal físico externo, con código de referencia).
  - La suma de los abonos registrados debe cuadrar con el total neto de la venta (o registrar el saldo pendiente autorizado).
- **RN-PAG-002 (Autorización obligatoria para entregas con saldo - Fiado):**
  - Si `total_pagado < total_neto` y el cliente se retira físicamente con los libros, la transacción **exige autorización obligatoria** mediante credenciales o PIN de un usuario con rol `Dueño` o `Administrador`.
  - Es mandatorio capturar: Nombre del cliente, número de teléfono/WhatsApp y número de documento de identidad (DNI).
  - La venta queda en `estado_entrega = 'entregado_saldo_pendiente'` y `estado_venta = 'pendiente_cobro'` (ref: [DEC-006](../06-gestion/DECISIONES.md#dec-006-autorización-de-entrega-con-saldo-pendiente-de-cobro-fiado)).
- **RN-PAG-003 (Amortización de saldos pendientes deudores):**
  - Cualquier abono posterior hacia una venta fiada debe registrarse indicando monto, medio de pago, usuario que cobra y la sesión de caja activa que recibe el dinero.
  - Al alcanzar `total_pagado == total_neto`, la venta transiciona automáticamente a `estado_pago = 'total'` y `estado_venta = 'completada'`.
- **RN-PAG-004 (Anticipos con mercadería retenida - Reserva):**
  - Si un cliente abona una parte del importe pero no cuenta con autorización para entrega con saldo pendiente, los libros **permanecen en custodia en la librería**.
  - La venta se registra con `estado_entrega = 'retenido'` y `estado_pago = 'parcial'`. Los ejemplares no pueden entregarse hasta la cancelación del 100% del saldo o autorización de fiado.

### 2.5 Caja y Egresos Operativos
- **RN-CAJ-001 (Obligatoriedad de sesión de caja activa):**
  - No se pueden registrar ventas que involucren cobranza en efectivo sin una sesión de caja en estado `Abierta`.
  - Solo puede existir **una única sesión de caja activa por dispositivo** en un momento dado.
- **RN-CAJ-002 (Cierres provisionales offline y conciliación remota):**
  - En ausencia de conexión a internet, el cierre de turno se almacena localmente como `Cierre Provisorio Offline`.
  - Al restablecerse la conexión, la sesión se sincroniza con Supabase. Si el saldo declarado coincide con el cálculo del servidor, pasa a `Cerrada y Conciliada`. Si existe descuadre o discrepancia con cobros concurrentes, queda en `Pendiente de Conciliación` para resolución del Administrador (ref: [DEC-007](../06-gestion/DECISIONES.md#dec-007-soporte-de-cierres-de-caja-offline-provisionales-con-conciliación-posterior)).
- **RN-CAJ-003 (Declaración física obligatoria por medio de pago):**
  - Al realizar el arqueo de cierre, el usuario debe realizar el conteo ciego de efectivo físico en gaveta.
  - El sistema contrastará el efectivo contado contra los ingresos netos en efectivo (apertura + ventas efectivo + cobranzas efectivo - gastos efectivo - retiros) para determinar sobrante o faltante. Los importes digitales y POS se concilian por lote de reporte externo.
- **RN-GAS-001 (Imputación y respaldo de gastos operativos):**
  - Todo gasto debe categorizarse (`Alquiler`, `Servicios Básicos`, `Suministros de Oficina`, `Mantenimiento`, `Personal`, `Otros`).
  - Debe especificarse si el dinero sale de la **caja en efectivo activa** (disminuye el arqueo teórico) o si se pagó con **fondos externos** (transferencia bancaria del dueño / cuenta no vinculada a caja física).

### 2.6 Proveedores y Pedidos
- **RN-PRV-001 (Cuentas corrientes y abonos a proveedores):**
  - Toda recepción de libros genera o incrementa la deuda con el proveedor respectivo.
  - Los abonos disminuyen la cuenta por pagar y deben respaldarse con el medio de pago utilizado y foto opcional de la constancia bancaria.
- **RN-PRV-002 (Protección de datos bancarios de proveedores):**
  - La información de cuentas bancarias (Banco, Tipo de Cuenta, Número de Cuenta, Código de Cuenta Interbancario - CCI, Titular) de los proveedores es confidencial.
  - Dicha información **solo será visible y editable por usuarios con rol Dueño o Administrador**. El Vendedor solo podrá consultar datos de contacto (Nombre comercial y WhatsApp).
- **RN-PRV-003 (Especialidad temática y contacto por WhatsApp):**
  - Cada proveedor debe registrar un número de WhatsApp operativo para coordinaciones ágiles de pedidos y catálogo.
  - Se debe clasificar el proveedor por sus categorías y sellos editoriales predominantes (ej. Distribuidor de textos universitarios, Novelas gráficas, Libros escolares).
- **RN-PED-001 (Ciclo de pedidos de faltantes sin proveedor inicial):**
  - Los pedidos de reposición pueden originarse con `estado_pedido = 'borrador_sin_asignar'` cuando un vendedor detecta libros agotados o pedidos específicos de clientes.
  - La asignación de proveedor puede realizarse posteriormente por el Dueño según cotización y disponibilidad.
- **RN-PED-002 (Recepciones parciales y saldos pendientes de entrega):**
  - Cuando un proveedor entrega solo una fracción de los libros solicitados, el pedido pasa a `Recepción Parcial`.
  - El sistema actualiza las cantidades recibidas por renglón y mantiene pendiente el saldo restante hasta su recepción final o descarte justificado.
- **RN-PED-003 (Pedidos de libros no catalogados por foto/texto libre):**
  - Se permite crear pedidos de libros que no existan previamente en la base de datos de catálogo (ej. captura fotográfica de una lista manuscrita de un cliente o foto de una portada requerida).
  - Al recepcionarse el pedido, el sistema ofrecerá el flujo asistido para incorporar formalmente el nuevo título al catálogo maestro.

### 2.7 Facturación y Comprobantes
- **RN-FAC-001 (Emisión de notas internas de venta en MVP):**
  - En la fase MVP todos los comprobantes emitidos son **Notas de Venta internas** no fiscales.
  - El diseño de datos y arquitectura desacoplada reserva los campos de serie, correlativo tributario, tipo de comprobante y hash de firma para habilitar facturación electrónica oficial en fases posteriores (ref: [DEC-008](../06-gestion/DECISIONES.md#dec-008-exclusión-de-facturación-electrónica-en-mvp-con-diseño-extensible)).

### 2.8 Operación Offline
- **RN-OFF-001 (Restricciones y operaciones autorizadas en modo offline):**
  - **Operaciones 100% autorizadas offline:** Registro de ventas, cobros mixtos, ventas rápidas con foto, consultas locales de catálogo, apertura y cierres de caja provisionales, registro de gastos de mostrador, toma de notas de pedidos.
  - **Operaciones bloqueadas en modo offline:** Creación de nuevos usuarios, modificación de roles y contraseñas, conciliación definitiva de cierres de caja con discrepancias y borrado permanente de datos maestros.

---

## 3. Matriz de Compatibilidad de Estados (Evitación de Estados Incompatibles)

Para prevenir inconsistencias transaccionales, se define la siguiente matriz de compatibilidad obligatoria entre **Estado de Venta**, **Estado de Pago** y **Estado de Entrega**:

| Estado de Venta | Estado de Pago Permitido | Estado de Entrega Permitido | Condición de Validez |
| :--- | :--- | :--- | :--- |
| **`Borrador`** | `Pendiente` | `Retenido` | Venta en proceso de armado; no genera deuda ni descuenta caja. |
| **`Completada`** | **`Total`** | **`Entregado Total`** | Venta cerrada regular: 100% pagada y mercadería retirada por cliente. |
| **`Pendiente de Regularización`**| `Total` o `Parcial` | `Entregado Total` o `Retenido` | Venta rápida con foto: importe cobrado, detalle de libros pendiente. |
| **`Pendiente de Cobro`** | **`Parcial`** o **`Pendiente`** | **`Entregado con Saldo Pendiente`** | **Exige autorización obligatoria de Dueño o Admin** (RN-PAG-002). |
| **`Pendiente de Cobro`** | **`Parcial`** | **`Retenido`** | Anticipo con reserva: cliente abonó parte pero no retira el libro (RN-PAG-004). |
| **`Anulada`** | `Anulado` | `Retenido` (restituido) | Venta cancelada: revierte movimientos de dinero y estado comercial. |

> [!CAUTION]
> **Combinaciones Estrictamente Prohibidas (Inválidas):**
> 1. `estado_venta = 'Completada'` con `estado_pago = 'Pendiente'` o `'Parcial'` (Una venta no puede estar completada si existe deuda).
> 2. `estado_entrega = 'Entregado Total'` con `estado_pago = 'Pendiente'` o `'Parcial'` (No se puede marcar entrega total sin cobro del 100% de la venta).
> 3. `estado_entrega = 'Entregado con Saldo Pendiente'` con `autorizador_id IS NULL` (Violación de seguridad: no se permite fiado sin usuario autorizador registrado).

---

## 4. Matriz de Control de Acceso Basado en Roles (RBAC)

| Módulo / Operación del Sistema | Vendedor | Dueño | Administrador | Regla Vinculada |
| :--- | :---: | :---: | :---: | :--- |
| Registrar venta ordinaria y cobro en mostrador | **Permitido** | **Permitido** | **Permitido** | RN-VTA-001 |
| Aplicar descuento libre > 15% | *Bloqueado* | **Permitido** | **Permitido** | RN-VTA-004 |
| Registrar venta rápida con foto | **Permitido** | **Permitido** | **Permitido** | RN-VTA-002 |
| Regularizar ítems de venta rápida | **Permitido** | **Permitido** | **Permitido** | RN-VTA-002 |
| Autorizar entrega de libros con saldo (Fiado) | *Bloqueado* | **Permitido** | **Permitido** | RN-PAG-002 |
| Registrar anticipo con reserva retenida | **Permitido** | **Permitido** | **Permitido** | RN-PAG-004 |
| Anular una venta registrada | *Bloqueado* | **Permitido** | **Permitido** | RN-VTA-003 |
| Apertura y arqueo diario de su caja | **Permitido** | **Permitido** | **Permitido** | RN-CAJ-001, RN-CAJ-003 |
| Cierre provisorio de caja en modo offline | **Permitido** | **Permitido** | **Permitido** | RN-CAJ-002 |
| Conciliar cierres de caja con diferencias | *Bloqueado* | **Permitido** | **Permitido** | RN-CAJ-002 |
| Registrar egresos menores de caja activa | **Permitido** | **Permitido** | **Permitido** | RN-GAS-001 |
| Registrar gastos extraordinarios de fondos externos | *Bloqueado* | **Permitido** | **Permitido** | RN-GAS-001 |
| Dar de alta / editar libros en catálogo | **Permitido** | **Permitido** | **Permitido** | RN-CAT-001, RN-CAT-004 |
| Consultar catálogo de libros por proveedor | **Permitido** | **Permitido** | **Permitido** | RN-PRV-003 |
| Ver costos de compra y cuentas bancarias de proveedores | *Bloqueado* | **Permitido** | **Permitido** | RN-PRV-002 |
| Autorizar abonos / pagos a proveedores | *Bloqueado* | **Permitido** | **Permitido** | RN-PRV-001 |
| Crear solicitudes de libros faltantes (borrador) | **Permitido** | **Permitido** | **Permitido** | RN-PED-001, RN-PED-003 |
| Asignar proveedor y emitir orden de pedido | *Bloqueado* | **Permitido** | **Permitido** | RN-PED-001 |
| Registrar recepción física de pedidos | **Permitido** | **Permitido** | **Permitido** | RN-PED-002 |
| Administrar cuentas de usuarios y roles del sistema | *Bloqueado* | *Bloqueado* | **Permitido** | SEC-AUTHZ-002 |
| Ver auditoría de seguridad y logs del sistema | *Bloqueado* | *Bloqueado* | **Permitido** | SEC-AUD-001 |
