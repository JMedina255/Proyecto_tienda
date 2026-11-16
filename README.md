# Sistema de Gestión de Librería — Proyecto Tienda

Plataforma integral de punto de venta (POS), administración de catálogo, compras a proveedores y control financiero para librerías físicas independientes, diseñada con una arquitectura resiliente *offline-first*.

**Repositorio Oficial en GitHub:** [https://github.com/JMedina255/Proyecto_tienda](https://github.com/JMedina255/Proyecto_tienda)  
**Rama principal:** `master`

---

## 1. Descripción y Problemática del Negocio

Las librerías físicas independientes enfrentan desafíos operativos y comerciales particulares que los sistemas tradicionales de punto de venta minorista no resuelven de forma eficiente:

- **Complejidad del catálogo bibliográfico:** Un mismo título puede coexistir en múltiples ediciones, formatos (tapa dura, rústica, bolsillo) y estados de conservación (nuevo, usado, de colección), con precios y costos marcadamente distintos.
- **Dinámica ágil en mostrador:** En momentos de alta afluencia o ventas al paso, los clientes demandan atención inmediata. Se requiere registrar ventas rápidas (incluso capturando una fotografía y postergando el detalle de ítems) y admitir pagos combinados (efectivo, transferencias, billeteras digitales y tarjetas POS), así como créditos o saldos pendientes autorizados.
- **Relaciones multi-proveedor y compras:** Un libro puede ser suministrado por distintos proveedores o distribuidores con condiciones comerciales y costos dispares. El abastecimiento suele iniciar con pedidos de títulos faltantes sin proveedor preasignado y recepciones fraccionadas con pagos parciales o abonos.
- **Inestabilidad de conectividad:** Las interrupciones en el servicio de internet no deben paralizar las ventas, la cobranza ni las operaciones de caja en mostrador. El sistema debe operar con total autonomía local y sincronizar de forma confiable cuando la red esté disponible.

---

## 2. Objetivos del Sistema

### Objetivo General
Desarrollar una solución tecnológica moderna, segura y orientada a la movilidad que centralice la gestión comercial, de catálogo, compras y tesorería de una librería física, garantizando continuidad operativa mediante capacidades *offline-first*.

### Objetivos Específicos
1. **Agilizar el punto de venta en mostrador:** Registrar ventas con múltiples títulos, descuentos flexibles, precios editables, medios de pago mixtos y soporte para ventas rápidas de emergencia.
2. **Optimizar la catalogación de libros:** Permitir el alta manual o asistida mediante captura fotográfica y reconocimiento óptico de caracteres (OCR) para extraer metadatos bibliográficos (ISBN, título, autor, editorial).
3. **Garantizar la continuidad operativa *offline*:** Permitir la ejecución íntegra de ventas, aperturas y cierres de caja sin conexión a internet, sincronizando y conciliando automáticamente con la nube al restablecerse la red.
4. **Administrar compras y cuentas por pagar:** Controlar pedidos de reposición, recepciones parciales, costos por proveedor, deudas pendientes y recordatorios de pago.
5. **Asegurar la trazabilidad financiera:** Registrar el flujo de caja diario (aperturas, cierres, arqueos provisionales) y los egresos operativos (alquiler, servicios públicos, gastos corrientes).

---

## 3. Alcance del Proyecto

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALCANCE DEL PROYECTO                            │
├───────────────────────────────────┬────────────────────────────────────┤
│   FASE ACTUAL: MVP MÓVIL (H00-H07) │      FASES FUTURAS (H08+)          │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Aplicación Android (React Native)│ • Panel Web administrativo (React) │
│ • Operación Offline con SQLite     │ • Facturación Electrónica          │
│ • Sincronización con Supabase     │ • Control cuantitativo de stock    │
│ • Captura asistida por OCR         │   (kardex, inventario físico)      │
│ • Ventas, cobros mixtos y fiados   │ • Múltiples sucursales / almacenes │
│ • Caja diaria y gastos corrientes  │ • Pasarelas de pago integradas     │
│ • Proveedores y pedidos faltantes  │ • Tienda en línea / eCommerce      │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Alcance Inicial (MVP Móvil Android)
- **Monotienda:** Diseñado para la operación de una única tienda física.
- **Catálogo referencial:** Registro de libros sin control cuantitativo estricto de inventario en mostrador durante el MVP (se valida disponibilidad física en tienda).
- **Múltiples ediciones y estados:** Soporte explícito para catalogar un título con diferentes ediciones y condiciones (nuevo vs. usado).
- **Venta en mostrador y venta rápida:** Emisión de notas de venta, modificación de precios/descuentos in situ, ventas rápidas con foto y regularización posterior.
- **Modalidades de pago flexibles:** Efectivo, tarjetas (POS externo), billeteras digitales (QR/transferencia), pagos mixtos y entregas con saldo pendiente (crédito/fiado) con autorización de encargado.
- **Control de caja:** Apertura y cierre diario; soporte de cierres provisionales en modo offline con posterior conciliación.
- **Gastos operativos:** Registro de salidas de dinero por servicios, alquiler y compras menores.
- **Gestión de proveedores:** Directorio, asociación libro-proveedor con costos variables, pedidos de libros faltantes (proveedor asignable a posteriori), recepciones parciales y abonos.
- **Motor Offline-First:** Persistencia completa en base de datos local (SQLite) y réplica bidireccional asíncrona hacia la nube (Supabase).

### Funcionalidades Futuras (Fuera del MVP)
- Panel de control web para auditoría y reportería gerencial avanzada.
- Integración con servicios de Facturación Electrónica (SUNAT/proveedor de comprobantes digitales).
- Módulo de control de inventario cuantitativo exacto con kardex, alertas de stock mínimo y auditorías de mermas.
- Soporte multitienda o multi-almacén.
- Pasarelas de pago digitales integradas directamente en el flujo de cobro.

---

## 4. Usuarios y Responsabilidades

| Rol | Responsabilidades y Atribuciones |
| :--- | :--- |
| **Administrador** | Control total de configuración, gestión de usuarios, asignación de permisos, conciliación definitiva de cierres de caja, auditoría de seguridad y reportes gerenciales. |
| **Dueño** | Operación comercial completa, autorización de ventas con saldo pendiente (fiado), gestión de compras y pagos a proveedores, consulta de rentabilidad y arqueos de caja. |
| **Vendedor** | Registro ágil de ventas en mostrador, emisión de ventas rápidas, consulta y alta rápida de libros en catálogo, registro de pagos ordinarios y solicitud de autorización para créditos. |

Para el detalle de roles y restricciones, consultar [REGLAS_NEGOCIO.md](docs/01-requerimientos/REGLAS_NEGOCIO.md).

---

## 5. Tecnologías Previstas

- **Monorepo:** Gestión unificada de paquetes y aplicaciones móviles/web mediante `pnpm` y `Turborepo` (ver propuesta en [ARQUITECTURA.md](docs/02-arquitectura/ARQUITECTURA.md)).
- **Aplicación Móvil:** React Native con Expo y TypeScript, optimizada para dispositivos Android en entorno de mostrador.
- **Panel Web (Futuro):** React con TypeScript y Tailwind CSS / Vite.
- **Backend & Base de Datos Remota:** [Supabase](https://supabase.com/) (PostgreSQL, GoTrue Authentication, Storage y Row Level Security).
- **Base de Datos Local:** SQLite en el dispositivo cliente, permitiendo lecturas y escrituras con latencia cero sin conexión.
- **Capa de Sincronización:** Motor asíncrono con cola de mutaciones locales (*outbox pattern*), resolución determinista de conflictos y marcas de tiempo UTC.
- **Captura Asistida:** Integración de OCR (reconocimiento óptico de caracteres) mediante modelos on-device o API de visión para lectura de portadas, contraportadas e ISBN.

---

## 6. Visión General de la Arquitectura

El sistema implementa una **Arquitectura Offline-First (Local-First)**:

```
┌────────────────────────────────────────────────────────┐
│                    DISPOSITIVO ANDROID                 │
│                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────┐ │
│  │     UI / React Native   │  │   Cámara + OCR       │ │
│  └───────────┬─────────────┘  └──────────┬───────────┘ │
│              │                           │             │
│  ┌───────────▼───────────────────────────▼───────────┐ │
│  │               Lógica de Negocio                   │ │
│  └───────────────────────┬───────────────────────────┘ │
│                          │                             │
│  ┌───────────────────────▼───────────────────────────┐ │
│  │     Capa de Almacenamiento Local (SQLite)         │ │
│  └───────────────────────┬───────────────────────────┘ │
│                          │                             │
│  ┌───────────────────────▼───────────────────────────┐ │
│  │   Motor de Sincronización (Outbox / Reconciler)   │ │
│  └───────────────────────┬───────────────────────────┘ │
└──────────────────────────┼─────────────────────────────┘
                           │ (Conexión asíncrona / TLS)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   BACKEND (SUPABASE)                   │
│                                                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────┐ │
│  │   Auth / JWT    │ │ PostgreSQL+RLS  │ │  Storage  │ │
│  └─────────────────┘ └─────────────────┘ └───────────┘ │
└────────────────────────────────────────────────────────┘
```

La aplicación móvil opera de forma autónoma interactuando exclusivamente contra la base de datos local SQLite. Una cola de sincronización en segundo plano transmite las mutaciones hacia Supabase cuando se detecta conectividad, resolviendo discrepancias mediante reglas de negocio predefinidas.

---

## 7. Organización Documental

Toda la documentación técnica y de gestión del proyecto reside en el directorio [`docs/`](docs/README.md), estructurada según las mejores prácticas de ingeniería de software:

- **[docs/README.md](docs/README.md):** Índice maestro y estado de elaboración de la documentación.
- **Requerimientos:**
  - [docs/01-requerimientos/SRS.md](docs/01-requerimientos/SRS.md): Especificación de Requerimientos de Software (RF, RNF, Casos de Uso).
  - [docs/01-requerimientos/REGLAS_NEGOCIO.md](docs/01-requerimientos/REGLAS_NEGOCIO.md): Políticas comerciales, restricciones y máquinas de estado.
- **Arquitectura y Datos:**
  - [docs/02-arquitectura/ARQUITECTURA.md](docs/02-arquitectura/ARQUITECTURA.md): Diseño de componentes, monorepo y estrategia *offline-first*.
  - [docs/02-arquitectura/MODELO_DATOS.md](docs/02-arquitectura/MODELO_DATOS.md): Esquema entidad-relación preliminar y convenciones relacionales.
- **Estándares y Diccionario:**
  - [docs/03-estandares/ESTANDAR_DOCUMENTACION.md](docs/03-estandares/ESTANDAR_DOCUMENTACION.md): Estándar permanente de documentación concisa, verificable y trazable.
  - [docs/03-estandares/ESTANDAR_PROGRAMACION.md](docs/03-estandares/ESTANDAR_PROGRAMACION.md): Convenciones de TypeScript, React Native, testing y estilo.
  - [docs/03-estandares/DICCIONARIO_DATOS.md](docs/03-estandares/DICCIONARIO_DATOS.md): Estructura formal de campos, tipos, claves y restricciones.
- **Seguridad:**
  - [docs/04-seguridad/HARDENING.md](docs/04-seguridad/HARDENING.md): Línea base de seguridad, RLS, cifrado local y auditoría.
- **Planificación:**
  - [docs/05-planificacion/PLAN_DESARROLLO.md](docs/05-planificacion/PLAN_DESARROLLO.md): Fases del proyecto, hitos, dependencias y entregables.
- **Gestión:**
  - [docs/06-gestion/DECISIONES.md](docs/06-gestion/DECISIONES.md): Registro de Decisiones de Arquitectura (ADR).
  - [docs/06-gestion/CHANGELOG.md](docs/06-gestion/CHANGELOG.md): Historial de cambios del proyecto.
- **Directrices para Agentes:**
  - [AGENTS.md](AGENTS.md): Reglas de operación obligatorias para asistentes y agentes de desarrollo.

---

## 8. Estado Actual del Proyecto

| Parámetro | Estado |
| :--- | :--- |
| **Fase actual** | Fase 2 — Construcción Incremental |
| **Hito completado recientemente** | **H06.5 — Cierre de idempotencia y preparación de despliegue Supabase** |
| **Hitos cerrados** | **H00** (Inicialización), **H00.1** (Auditoría), **H00.2** (Git y versionado), **H01** (SRS y reglas), **H01.1** (Simplificación y normalización), **H02** (Arquitectura), **H02.1** (Correcciones críticas), **H03** (Modelo y diccionario), **H04** (Estándares y hardening), **H05** (Planificación y pruebas), **H06** (Monorepo base), **H06.1** (Estabilización Android), **H06.2** (Atomicidad SQLite y Supabase), **H06.3** (Contratos y seguridad sync), **H06.4** (Hardening RPC y validación Postgres), **H06.5** (Idempotencia atómica y despliegue preparado) |
| **Repositorio remoto** | [https://github.com/JMedina255/Proyecto_tienda.git](https://github.com/JMedina255/Proyecto_tienda) (rama `master`) |
| **Código fuente** | Monorepo estabilizado, persistencia SQLite con WAL y durabilidad FULL, `AsyncTransactionMutex` con `BEGIN IMMEDIATE;`, contratos unificados de sincronización, RPC hardening con `search_path = ''`, RLS estricto, idempotencia con reserva atómica y 67 pruebas automatizadas aprobadas al 100% (incluyendo 12 pruebas en PGlite y 2 pruebas de concurrencia real multi-conexión TCP en PostgreSQL) |
| **Servicios externos** | Infraestructura local de Supabase con hardening total (`config.toml`, migración `20261115000001_sync_infrastructure.sql` validada en PostgreSQL 18 real con RLS, comprobación de propiedad, verificación de filas afectadas, reserva atómica previa e idempotencia reforzada). Protocolo controlado de despliegue documentado en `HARDENING.md` (§2.10). Proyecto remoto `hixrwpiyyhrifsxgekfe` preservado intacto en modo read-only |
| **Próximo hito** | **H07:** Catálogo bibliográfico, categorías, ediciones y captura asistida por OCR on-device |
