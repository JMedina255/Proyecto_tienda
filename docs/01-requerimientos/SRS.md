# Especificación de Requerimientos de Software (SRS)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda  
**Documento:** SRS.md  
**Estado:** Estructura base / Requerimientos preliminares consolidados para H00  
**Norma de referencia:** Basado en IEEE 830 / ISO/IEC/IEEE 29148  

---

## 1. Introducción

### 1.1 Propósito
El propósito de este documento es definir formalmente los requerimientos funcionales y no funcionales, actores del sistema, casos de uso y criterios de aceptación para el desarrollo del **Sistema de Gestión de Librería**, iniciando por su aplicación móvil Android *offline-first* y sentando las bases para su extensión hacia un panel web administrativo.

### 1.2 Alcance del Producto
El sistema cubrirá de forma integral el ciclo de operaciones de una tienda física única:
- Administración de catálogo bibliográfico estructurado por títulos, ediciones y estados (nuevo/usado).
- Asistencia en catalogación mediante reconocimiento óptico de caracteres (OCR).
- Punto de venta rápido y ágil con soporte para pagos mixtos, parciales (crédito/fiado) y ventas rápidas con foto.
- Apertura, control de movimientos y cierre diario de caja (con soporte de cierres provisionales sin internet).
- Registro de gastos y egresos operativos.
- Gestión de proveedores, costos de compra, pedidos de reposición, recepciones parciales y abonos.
- Operación autónoma sin internet (Offline-First) con sincronización asíncrona hacia Supabase.

*Exclusiones del MVP:* No se contempla control cuantitativo estricto de inventario (kardex) ni emisión de comprobantes de facturación electrónica fiscal en esta primera fase (ver [DEC-003](../06-gestion/DECISIONES.md#dec-003-catálogo-referencial-sin-control-cuantitativo-estricto-de-stock-en-mvp) y [DEC-008](../06-gestion/DECISIONES.md#dec-008-exclusión-de-facturación-electrónica-en-mvp-con-diseño-extensible)).

### 1.3 Definiciones, Acrónimos y Abreviaturas
- **POS:** *Point of Sale* (Punto de Venta).
- **OCR:** *Optical Character Recognition* (Reconocimiento Óptico de Caracteres).
- **Offline-First:** Patrón arquitectónico donde la aplicación es plenamente funcional sin conexión a red, utilizando una base de datos local y sincronizando cuando la conexión esté disponible.
- **RLS:** *Row Level Security* (Seguridad a Nivel de Fila en PostgreSQL).
- **Venta Rápida:** Transacción de venta registrada con importe y fotografía, postergando la especificación de títulos para un momento posterior de baja afluencia.
- **Fiado / Saldo Pendiente:** Venta en la que se entrega físicamente el libro al cliente con un cobro parcial o nulo, autorizada expresamente por un encargado.

### 1.4 Referencias Relativas
- Políticas de negocio y máquinas de estado: [REGLAS_NEGOCIO.md](REGLAS_NEGOCIO.md)
- Arquitectura del sistema y monorepo: [../02-arquitectura/ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md)
- Modelo de datos preliminar: [../02-arquitectura/MODELO_DATOS.md](../02-arquitectura/MODELO_DATOS.md)
- Decisiones de arquitectura confirmadas: [../06-gestion/DECISIONES.md](../06-gestion/DECISIONES.md)

---

## 2. Descripción General

### 2.1 Perspectiva del Producto
El sistema se compone inicialmente de una aplicación cliente nativa para Android desarrollada en React Native y Expo, respaldada localmente por SQLite. Dicha aplicación se comunicará de manera asíncrona con una instancia de Supabase (PostgreSQL, GoTrue Auth, Storage) en la nube. A futuro, un panel web en React compartirá la misma base de datos e identidades en Supabase.

### 2.2 Clases y Características de Usuarios (Actores)

| Actor | Descripción y Permisos |
| :--- | :--- |
| **Administrador** | Usuario con control total del sistema. Puede gestionar usuarios, revocar accesos, conciliar definitivamente cierres de caja offline, auditar logs y acceder a todos los reportes consolidados. |
| **Dueño** | Responsable de la gestión comercial y financiera de la librería. Autoriza entregas con saldo pendiente (fiado), gestiona proveedores, aprueba pedidos y abonos, y supervisa la caja. |
| **Vendedor** | Personal de mostrador. Registra ventas ordinarias y ventas rápidas, consulta el catálogo, añade libros preliminares, registra pagos recibidos y solicita autorización para créditos. |

---

## 3. Requerimientos Funcionales (RF)

Los requerimientos funcionales se agrupan por módulos operativos y utilizan la nomenclatura preliminar `RF-[MOD]-[NUM]`:

### Módulo de Catálogo y OCR (RF-CAT)
- **RF-CAT-001 (Estructura de catálogo):** El sistema debe permitir registrar libros separando la información bibliográfica genérica (título, autor, editorial, año, sinopsis) de sus ediciones específicas (formato tapa blanda/dura, estado nuevo/usado, precio referencial, carátula) (ref: [DEC-004](../06-gestion/DECISIONES.md#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación)).
- **RF-CAT-002 (Búsqueda en catálogo):** El sistema debe proveer búsqueda rápida e incremental en modo local por título, autor, editorial, código ISBN o palabras clave.
- **RF-CAT-003 (Captura asistida por OCR):** El sistema debe permitir tomar o seleccionar una fotografía de la portada, contraportada o página legal de un libro y extraer texto automáticamente para precompletar campos de catalogación (ref: [DEC-010](../06-gestion/DECISIONES.md#dec-010-captura-asistida-de-libros-mediante-fotografía-y-ocr)).
- **RF-CAT-004 (Validación de captura OCR):** El sistema debe permitir al usuario revisar, corregir y confirmar manualmente los datos extraídos por el OCR antes de persistirlos en el catálogo local.

### Módulo de Ventas y Mostrador (RF-VTA)
- **RF-VTA-001 (Venta multitítulo):** El sistema debe permitir registrar ventas compuestas por uno o múltiples títulos del catálogo, con cantidades configurables.
- **RF-VTA-002 (Precios y descuentos editables):** El sistema debe permitir al vendedor modificar el precio unitario del libro en mostrador o aplicar un descuento (monto fijo o porcentaje) sobre la línea o sobre el total de la venta (ref: [RN-VTA-001](REGLAS_NEGOCIO.md#rn-vta-001-flexibilidad-de-precios-y-descuentos-en-mostrador)).
- **RF-VTA-003 (Venta rápida con fotografía):** El sistema debe permitir registrar una venta rápida capturando únicamente el importe total cobrado, el medio de pago y una fotografía de respaldo, guardando la transacción en estado `Pendiente de Regularización` (ref: [DEC-011](../06-gestion/DECISIONES.md#dec-011-modalidad-de-venta-rápida-con-foto-y-detalle-pendiente-de-completar)).
- **RF-VTA-004 (Bandeja de regularización de ventas rápidas):** El sistema debe listar las ventas rápidas pendientes y permitir desglosar los libros involucrados para completar el detalle comercial.
- **RF-VTA-005 (Anulación de ventas):** El sistema debe permitir la anulación de ventas únicamente a usuarios con rol Dueño o Administrador, registrando el motivo y revirtiendo el impacto en caja.

### Módulo de Pagos y Créditos (RF-PAG)
- **RF-PAG-001 (Medios de pago múltiples):** El sistema debe admitir registros de pago mediante efectivo, tarjeta bancaria (POS externo) y billetera digital (QR / transferencia bancaria).
- **RF-PAG-002 (Pagos mixtos):** El sistema debe permitir fraccionar el importe total de una venta en múltiples pagos utilizando diferentes medios de pago dentro de la misma transacción.
- **RF-PAG-003 (Pagos parciales y saldo pendiente):** El sistema debe permitir registrar pagos parciales donde el monto abonado sea inferior al total de la venta, calculando y registrando el `saldo_pendiente`.
- **RF-PAG-004 (Autorización de entrega con saldo):** El sistema debe exigir la autorización explícita (mediante PIN, contraseña o confirmación de sesión) de un Dueño o Administrador cuando se pretenda entregar un libro con saldo pendiente (ref: [DEC-006](../06-gestion/DECISIONES.md#dec-006-autorización-de-entrega-con-saldo-pendiente-de-cobro-fiado)).
- **RF-PAG-005 (Registro de amortizaciones/cobros posteriores):** El sistema debe permitir asociar abonos posteriores a una venta con saldo pendiente hasta su liquidación total.

### Módulo de Caja y Egresos (RF-CAJ y RF-GAS)
- **RF-CAJ-001 (Apertura de caja diaria):** El sistema debe exigir el registro de una apertura de caja indicando el monto inicial en efectivo antes de permitir registrar cobros en mostrador.
- **RF-CAJ-002 (Movimientos de caja):** El sistema debe registrar automáticamente los ingresos por ventas en efectivo y permitir ingresos o retiros manuales extraordinarios debidamente justificados.
- **RF-CAJ-003 (Cierre y arqueo de caja):** El sistema debe solicitar el conteo físico de efectivo al cierre de turno, contrastarlo contra el saldo teórico calculado y determinar discrepancias (sobrantes o faltantes).
- **RF-CAJ-004 (Cierres provisionales offline):** El sistema debe permitir efectuar el cierre de caja incluso en ausencia de conexión a internet, asignándole el estado `Cierre Provisorio Offline` hasta su conciliación remota (ref: [DEC-007](../06-gestion/DECISIONES.md#dec-007-soporte-de-cierres-de-caja-offline-provisionales-con-conciliación-posterior)).
- **RF-GAS-001 (Registro de gastos operativos):** El sistema debe permitir registrar salidas de dinero clasificadas por categorías (alquiler, luz, agua, internet, suministros, otros), adjuntando descripción, monto y fotografía opcional de comprobante.
- **RF-GAS-002 (Imputación de egresos):** El sistema debe permitir indicar si un gasto fue pagado con el efectivo de la caja activa o mediante fondos externos (cuenta bancaria / bolsillo del dueño).

### Módulo de Proveedores y Pedidos (RF-PRV y RF-PED)
- **RF-PRV-001 (Directorio de proveedores):** El sistema debe registrar proveedores con datos de contacto (nombre comercial, teléfono, email, dirección, notas).
- **RF-PRV-002 (Asociación libro-proveedor):** El sistema debe permitir vincular una edición de libro a múltiples proveedores, guardando el costo referencial y código de proveedor específico (ref: [DEC-005](../06-gestion/DECISIONES.md#dec-005-relación-muchos-a-muchos-entre-libros-y-proveedores-con-costos-variables)).
- **RF-PED-001 (Registro de pedidos de faltantes):** El sistema debe permitir crear listas de pedidos de libros faltantes o por encargo sin necesidad de tener un proveedor asignado inicialmente.
- **RF-PED-002 (Asignación posterior de proveedor):** El sistema debe permitir asignar un proveedor específico a un pedido de libros previamente registrado.
- **RF-PED-003 (Recepciones parciales):** El sistema debe permitir recepcionar cantidades parciales de un pedido, actualizando el estado de cada ítem (pendiente vs. recibido).
- **RF-PRV-003 (Cuentas por pagar y abonos a proveedores):** El sistema debe llevar el saldo de deuda con cada proveedor y permitir registrar abonos con comprobante asociado.
- **RF-PED-004 (Recordatorios de pedidos pendientes):** El sistema debe mostrar alertas y recordatorios de pedidos con fecha estimada de entrega vencida o pagos pendientes a proveedores.

### Módulo de Reportería y Dashboard (RF-REP)
- **RF-REP-001 (Resumen de ventas):** El sistema debe generar reportes diarios, semanales y mensuales de ventas totales, ticket promedio, desglose por medio de pago y descuentos aplicados.
- **RF-REP-002 (Reporte de caja y gastos):** El sistema debe generar reportes comparativos de ingresos de caja frente a egresos por gastos operativos.
- **RF-REP-003 (Reporte de cuentas por cobrar y pagar):** El sistema debe emitir reportes de saldos pendientes de clientes (fiados) y cuentas por pagar a distribuidores.

### Módulo de Operación Offline y Sincronización (RF-OFF)
- **RF-OFF-001 (Autonomía offline total):** El sistema debe permitir operar las funciones críticas de mostrador (ventas, pagos, cobros, consultas de catálogo y cierres de caja) sin conexión de red (ref: [DEC-009](../06-gestion/DECISIONES.md#dec-009-arquitectura-offline-first-con-sqlite-local-y-supabase-remoto)).
- **RF-OFF-002 (Cola de sincronización en segundo plano):** El sistema debe encolar las operaciones locales y enviarlas a Supabase en cuanto se detecte conectividad activa.
- **RF-OFF-003 (Conciliación y resolución de conflictos):** El sistema debe resolver conflictos mediante marcas de tiempo deterministas y alertar al Administrador en caso de discrepancias financieras o de caja.

---

## 4. Requerimientos No Funcionales (RNF)

### 4.1 Usabilidad y Ergonomía (RNF-USAB)
- **RNF-USAB-001 (Operación táctil ágil):** La interfaz móvil debe estar optimizada para el uso con una sola mano y botones táctiles de al menos 48x48 dp para agilizar la interacción en mostrador.
- **RNF-USAB-002 (Registro de venta en menos de 30 segundos):** Un vendedor capacitado debe poder completar una venta habitual de 1 a 3 libros en menos de 30 segundos.

### 4.2 Rendimiento y Eficiencia (RNF-PERF)
- **RNF-PERF-001 (Latencia local inmediata):** Las consultas y escrituras sobre la base de datos local SQLite deben responder en menos de 100 milisegundos en condiciones normales de hardware.
- **RNF-PERF-002 (Tiempo de inferencia OCR):** El procesamiento de OCR on-device para extracción de texto debe tomar menos de 3 segundos por imagen en dispositivos Android modernos.

### 4.3 Confiabilidad y Disponibilidad (RNF-CONF)
- **RNF-CONF-001 (Resiliencia ante caídas de red):** La aplicación no debe fallar, bloquearse ni mostrar pantallas de error crítico al perder conectividad durante una transacción de venta.
- **RNF-CONF-002 (Integridad transaccional local):** Toda operación de venta que afecte múltiples tablas locales (venta, detalles, pagos, movimientos de caja) debe ejecutarse bajo una transacción ACID de SQLite.

### 4.4 Seguridad y Confidencialidad (RNF-SEC)
- **RNF-SEC-001 (Control de acceso basado en roles - RBAC):** La aplicación debe aplicar permisos según el rol activo (Administrador, Dueño, Vendedor) tanto en la interfaz como en las políticas de seguridad RLS de Supabase.
- **RNF-SEC-002 (Almacenamiento seguro de credenciales):** Los tokens JWT de sesión deben almacenarse utilizando el Android Keystore a través de `expo-secure-store`.
- **RNF-SEC-003 (Cifrado en tránsito):** Todas las comunicaciones entre el cliente y Supabase deben cursarse obligatoriamente bajo HTTPS/TLS 1.3.

### 4.5 Portabilidad y Mantenibilidad (RNF-PORT)
- **RNF-PORT-001 (Compatibilidad Android):** La aplicación debe ser compatible con dispositivos Android desde la versión 10 (API level 29) en adelante.
- **RNF-PORT-002 (Reutilización en monorepo):** Los tipos de datos, validaciones y lógica de dominio deben residir en paquetes compartidos para su reutilización en el futuro panel web.

---

## 5. Casos de Uso Preliminares y Criterios de Aceptación (CU)

### CU-VTA-01: Registrar Venta con Pago Mixto
- **Actor principal:** Vendedor
- **Precondición:** Existe una sesión de caja activa en el dispositivo.
- **Criterio de Aceptación (Gherkin):**
  ```gherkin
  Escenario: Venta con pago dividido entre efectivo y billetera digital
    Dado que el vendedor tiene una venta en curso con total de 100.00 soles
    Cuando registra un pago de 40.00 soles en efectivo
    Y registra un pago de 60.00 soles en billetera digital con número de operación "OP-9874"
    Y presiona "Confirmar Venta"
    Entonces la venta se registra con estado_venta "Completada" y estado_pago "Total"
    Y el saldo_pendiente es 0.00 soles
    Y se genera un movimiento de ingreso en la caja activa por 40.00 soles en efectivo
  ```

### CU-VTA-02: Registrar Venta Rápida con Fotografía
- **Actor principal:** Vendedor
- **Precondición:** Caja activa.
- **Criterio de Aceptación (Gherkin):**
  ```gherkin
  Escenario: Venta rápida durante congestión de clientes
    Dado que el vendedor selecciona "Venta Rápida"
    Cuando ingresa el monto cobrado de 50.00 soles
    Y selecciona el medio de pago "Efectivo"
    Y captura una fotografía del libro vendido con la cámara del dispositivo
    Y presiona "Guardar Venta Rápida"
    Entonces la venta queda guardada con estado_venta "Pendiente de Regularización"
    Y el ingreso de 50.00 soles se añade a la sesión de caja activa
    Y la fotografía queda vinculada localmente para posterior sincronización a Storage
  ```

### CU-PAG-01: Entrega de Libros con Saldo Pendiente (Fiado)
- **Actor principal:** Vendedor / Dueño
- **Precondición:** Venta en curso con saldo por pagar mayor a cero.
- **Criterio de Aceptación (Gherkin):**
  ```gherkin
  Escenario: Autorización de entrega con saldo pendiente
    Dado que el total de la venta es 80.00 soles y el cliente abona 30.00 soles
    Y resta un saldo pendiente de 50.00 soles
    Cuando el vendedor solicita "Entregar con saldo pendiente"
    Y el usuario con rol Dueño ingresa sus credenciales de autorización
    Entonces la venta se registra con estado_entrega "Entregado con Saldo Pendiente"
    Y se almacena el identificador del Dueño como autorizador
    Y se crea la cuenta por cobrar asociada al cliente por 50.00 soles
  ```

### CU-CAJ-01: Cierre de Caja Provisorio en Modo Offline
- **Actor principal:** Vendedor
- **Precondición:** No hay conexión a internet y el turno ha finalizado.
- **Criterio de Aceptación (Gherkin):**
  ```gherkin
  Escenario: Arqueo y cierre de caja sin conexión
    Dado que el dispositivo no tiene acceso a internet
    Y la sesión de caja actual tiene ventas registradas en SQLite
    Cuando el vendedor realiza el arqueo ingresando el monto contado
    Y confirma el cierre de caja
    Entonces la sesión de caja local pasa al estado "Cierre Provisorio Offline"
    Y no se permite registrar nuevas ventas sobre esa sesión
    Y la operación se encola en la bandeja de sincronización pendiente
  ```

---

## 6. Estado de Madurez y Próximos Pasos

Este documento representa la línea base de requerimientos consolidada en el **Hito H00**. En los siguientes hitos se detallarán las especificaciones técnicas finas de cada caso de uso y se vincularán directamente con los contratos de TypeScript y el modelo de datos.
