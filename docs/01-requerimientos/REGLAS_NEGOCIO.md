# Reglas de Negocio y Políticas Operativas (REGLAS_NEGOCIO.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda<br>
**Documento:** REGLAS_NEGOCIO.md<br>
**Estado:** Simplificado y Normalizado en H01.1<br>
**Trazabilidad:** [SRS.md](SRS.md) | [../06-gestion/DECISIONES.md](../06-gestion/DECISIONES.md)<br>
**Total de Reglas de Negocio:** 27 reglas catalogadas (26 confirmadas vinculantes + 1 propuesta técnica pendiente).

---

## 1. Catálogo Consolidado de Reglas de Negocio (RN)

### 1.1 Alcance e Inventario
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-ALC-001** | Tienda única | Operación exclusiva en una sola sede física. Sin transferencias entre almacenes en MVP. | [DEC-001](../06-gestion/DECISIONES.md#dec-001-alcance-inicial-restringido-a-tienda-única) | **Confirmada** |
| **RN-STK-001** | Catálogo referencial | El sistema no bloquea ventas por stock numérico en base de datos. La existencia es verificada físicamente en mostrador. | [DEC-003](../06-gestion/DECISIONES.md#dec-003-catálogo-referencial-sin-control-cuantitativo-estricto-de-stock-en-mvp) | **Confirmada** |

### 1.2 Catálogo, Categorías y Ediciones
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-CAT-001** | Edición y conservación | Un título (`libros`) se desglosa en múltiples variantes (`ediciones_libro`) por editorial, año, formato y estado (`Nuevo`/`Usado`), con precios y costos independientes. | [DEC-004](../06-gestion/DECISIONES.md#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación) | **Confirmada** |
| **RN-CAT-002** | Multi-proveedor | Una edición puede vincularse a múltiples proveedores, registrando costo de adquisición y código propio por proveedor. | [DEC-005](../06-gestion/DECISIONES.md#dec-005-relación-muchos-a-muchos-entre-libros-y-proveedores-con-costos-variables) | **Confirmada** |
| **RN-CAT-003** | Validación OCR humana | Ningún registro capturado por cámara u OCR ingresa al catálogo activo sin confirmación o edición manual de un usuario. | [DEC-010](../06-gestion/DECISIONES.md#dec-010-captura-asistida-de-libros-mediante-fotografía-y-ocr) | **Confirmada** |
| **RN-CAT-004** | Registro sin ISBN y duplicidad | Se permite registrar libros sin ISBN (asigna código interno `LIB-XXXXXX`). Si tiene ISBN, se valida unicidad; si no tiene, se alerta duplicidad si título + autor coincide >85%. | H01 | **Confirmada** |
| **RN-CAT-005** | Categorías obligatorias | Todo libro debe asociarse obligatoriamente al menos a una categoría temática principal. | H01 | **Confirmada** |

### 1.3 Ventas y Mostrador
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-VTA-001** | Flexibilidad de precios | Precios y descuentos modificables en mostrador. El total neto nunca puede ser negativo. | N/A | **Confirmada** |
| **RN-VTA-002** | Venta rápida | Registro exprés con importe, medio de pago y fotografía. Genera estado `pendiente_regularizacion`. El desglose de libros debe completarse antes del cierre diario. | [DEC-011](../06-gestion/DECISIONES.md#dec-011-modalidad-de-venta-rápida-con-foto-y-detalle-pendiente-de-completar) | **Confirmada** |
| **RN-VTA-003** | Anulación de venta | Exclusiva para Dueño o Admin. Requiere motivo textual (>=10 caracteres) y restituye automáticamente el efectivo a caja si aplica. | N/A | **Confirmada** |
| **RN-VTA-004** | Límite descuento vendedor | *(Propuesta pendiente de decisión)*: Limitar descuento autónomo de Vendedor a 15%; descuentos mayores requerirían PIN de Dueño/Admin. | [DEC-016](../06-gestion/DECISIONES.md#dec-016-política-de-descuentos-máximos-delegados) | **Propuesta Pendiente** |

### 1.4 Pagos, Cobranzas y Créditos
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-PAG-001** | Medios de pago combinados | Se admiten pagos mixtos fraccionando entre Efectivo (con cálculo de vuelto), Billetera Digital (con N° operación) y POS (con código referencia). | N/A | **Confirmada** |
| **RN-PAG-002** | Autorización de fiados | Si el cliente retira mercadería con saldo pendiente (`total_pagado < total_neto`), exige autorización de Dueño/Admin y registro de nombre, teléfono y DNI del deudor. | [DEC-006](../06-gestion/DECISIONES.md#dec-006-autorización-de-entrega-con-saldo-pendiente-de-cobro-fiado) | **Confirmada** |
| **RN-PAG-003** | Amortización de deuda | Los abonos a ventas fiadas registran fecha, monto, caja receptora y medio de pago, liquidando el saldo hasta `estado_pago = 'total'`. | N/A | **Confirmada** |
| **RN-PAG-004** | Reserva con anticipo | Si hay cobro parcial sin autorización de fiado, el libro permanece físicamente custodiado en tienda (`estado_entrega = 'retenido'`). | H01 | **Confirmada** |

### 1.5 Caja y Egresos Operativos
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-CAJ-001** | Caja activa obligatoria | Se prohíbe registrar ventas o cobranzas en efectivo sin una sesión de caja `Abierta`. Máximo una caja activa por terminal. | N/A | **Confirmada** |
| **RN-CAJ-002** | Cierre offline y conciliación | Sin red, el cierre se guarda como `Cierre Provisorio Offline`. Al reconectar, pasa a `Cerrada y Conciliada` o queda en revisión si hay discrepancias. | [DEC-007](../06-gestion/DECISIONES.md#dec-007-soporte-de-cierres-de-caja-offline-provisionales-con-conciliación-posterior) | **Confirmada** |
| **RN-CAJ-003** | Arqueo físico desglosado | El usuario declara el efectivo contado ciego en gaveta física. Los medios digitales y POS se concilian por lote electrónico. | H01 | **Confirmada** |
| **RN-GAS-001** | Imputación de egresos | Los gastos deben categorizarse. Se indica si se pagan con efectivo de caja (disminuye arqueo) o fondos externos del dueño (no afecta gaveta). | N/A | **Confirmada** |

### 1.6 Proveedores y Pedidos
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-PRV-001** | Cuentas por pagar | La recepción de mercadería genera deuda con el proveedor. Los abonos disminuyen el saldo y pueden respaldarse con foto de constancia. | N/A | **Confirmada** |
| **RN-PRV-002** | Protección datos bancarios | Datos bancarios de proveedores (banco, cuenta, CCI, titular) son visibles y editables exclusivamente por Dueño y Administrador. | [SEC-AUTHZ-002](../04-seguridad/HARDENING.md) | **Confirmada** |
| **RN-PRV-003** | WhatsApp y especialidad | Cada proveedor registra número de WhatsApp directo y tipos de libros comercializados. | H01 | **Confirmada** |
| **RN-PED-001** | Pedidos sin proveedor | Solicitudes de faltantes se inician en `borrador_sin_asignar`. El Dueño asigna el proveedor posteriormente. | N/A | **Confirmada** |
| **RN-PED-002** | Recepción parcial | Entregas incompletas transicionan a `Recepción Parcial`, incrementando deuda solo por los ejemplares recibidos. | N/A | **Confirmada** |
| **RN-PED-003** | Pedidos no catalogados | Se admiten pedidos por texto libre o fotografía de listas manuscritas de clientes sin exigir ID de catálogo previo. | H01 | **Confirmada** |

### 1.7 Facturación y Comprobantes
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-FAC-001** | Notas internas en MVP | En MVP se emiten comprobantes internos. El esquema de datos reserva campos para serie, correlativo y tipo de comprobante electrónico futuro. | [DEC-008](../06-gestion/DECISIONES.md#dec-008-exclusión-de-facturación-electrónica-en-mvp-con-diseño-extensible) | **Confirmada** |

### 1.8 Operación Offline
| ID | Regla | Especificación Operativa | Decisión | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **RN-OFF-001** | Operaciones sin red | **Permitidas:** ventas, cobros, consultas de catálogo, arqueos provisionales y gastos. **Bloqueadas sin red:** creación de usuarios, cambio de roles y conciliación definitiva de cierres con diferencias. | [DEC-009](../06-gestion/DECISIONES.md#dec-009-arquitectura-offline-first-con-sqlite-local-y-supabase-remoto) | **Confirmada** |

---

## 2. Matriz de Compatibilidad de Estados Transaccionales

| Estado de Venta | Estado de Pago | Estado de Entrega | Validez | Justificación Operativa |
| :--- | :--- | :--- | :---: | :--- |
| `Borrador` | `Pendiente` | `Retenido` | **Válida** | Venta en edición; sin impacto financiero. |
| `Completada` | `Total` | `Entregado Total` | **Válida** | Venta ordinaria pagada al 100% y retirada por cliente. |
| `Pendiente de Regularización` | `Total` o `Parcial` | `Entregado Total` o `Retenido` | **Válida** | Venta rápida con foto; libros pendientes de asociar. |
| `Pendiente de Cobro` | `Parcial` o `Pendiente` | `Entregado con Saldo Pendiente` | **Válida** | Fiado autorizado por Dueño/Admin con deudor registrado. |
| `Pendiente de Cobro` | `Parcial` | `Retenido` | **Válida** | Anticipo con reserva: cliente paga parte, libro queda en tienda. |
| `Anulada` | `Anulado` | `Retenido` | **Válida** | Transacción anulada; dinero restituido a gaveta. |
| *Cualquiera* | `Pendiente` o `Parcial` | `Entregado Total` | **INVÁLIDA** | Prohibido entregar mercadería sin cancelación o autorización de fiado. |
| `Completada` | `Pendiente` o `Parcial` | *Cualquiera* | **INVÁLIDA** | Una venta no puede estar completada si existe saldo deudor. |
| *Cualquiera* | *Cualquiera* | `Entregado con Saldo Pendiente` | **INVÁLIDA** | Inválida si `autorizador_id IS NULL` (falta aprobación de encargado). |

---

## 3. Matriz de Control de Acceso por Rol (RBAC)

| Operación | Vendedor | Dueño | Administrador | Regla Vinculada |
| :--- | :---: | :---: | :---: | :--- |
| Venta normal y cobros en mostrador | Sí | Sí | Sí | RN-VTA-001, RN-PAG-001 |
| Venta rápida con fotografía | Sí | Sí | Sí | RN-VTA-002 |
| Regularizar ítems de venta rápida | Sí | Sí | Sí | RN-VTA-002 |
| Autorizar entrega con saldo (Fiado) | **No** | Sí | Sí | RN-PAG-002 |
| Anticipo con libro retenido (Reserva) | Sí | Sí | Sí | RN-PAG-004 |
| Anular ventas registradas | **No** | Sí | Sí | RN-VTA-003 |
| Apertura y arqueo diario de su caja | Sí | Sí | Sí | RN-CAJ-001, RN-CAJ-003 |
| Cierre provisorio offline | Sí | Sí | Sí | RN-CAJ-002 |
| Conciliar cierres con diferencias | **No** | Sí | Sí | RN-CAJ-002 |
| Registrar gastos de caja activa | Sí | Sí | Sí | RN-GAS-001 |
| Registrar gastos de fondos externos | **No** | Sí | Sí | RN-GAS-001 |
| Alta y edición en catálogo | Sí | Sí | Sí | RN-CAT-001, RN-CAT-004 |
| Ver datos bancarios de proveedores | **No** | Sí | Sí | RN-PRV-002 |
| Pedidos de faltantes (borrador) | Sí | Sí | Sí | RN-PED-001, RN-PED-003 |
| Asignar proveedor y emitir orden | **No** | Sí | Sí | RN-PED-001 |
| Recepción física de pedidos | Sí | Sí | Sí | RN-PED-002 |
| Gestión de usuarios y credenciales | **No** | **No** | Sí | SEC-AUTHZ-002 |
| Auditoría de seguridad y logs | **No** | **No** | Sí | SEC-AUD-001 |
