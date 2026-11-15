# Registro de Decisiones de Arquitectura y Negocio (DECISIONES.md)

Este documento registra formalmente las decisiones clave de negocio, técnicas y arquitectónicas que rigen el proyecto **Sistema de Gestión de Librería**.

Cada decisión cuenta con un identificador único, fecha de registro, estado, contexto, decisión adoptada, justificación técnica y consecuencias.

---

## Convención de Estados

- **Confirmado:** Decisión aprobada y vinculante para el desarrollo del sistema.
- **Propuesto:** Propuesta técnica en evaluación; pendiente de consenso o validación técnica.
- **Pendiente de decisión:** Asunto identificado que requiere análisis técnico o definición por los interesados antes de implementarse.
- **Descartado:** Alternativa analizada y desestimada, con justificación de su rechazo.

---

## Índice de Decisiones

| ID | Título | Estado | Fecha de Registro |
| :--- | :--- | :--- | :--- |
| [DEC-001](#dec-001-alcance-inicial-restringido-a-tienda-única) | Alcance inicial restringido a tienda única | **Confirmado** | 2026-11-15 |
| [DEC-002](#dec-002-estrategia-de-plataforma-android-primero-y-panel-web-posterior) | Estrategia de plataforma: Android primero y panel web posterior | **Confirmado** | 2026-11-15 |
| [DEC-003](#dec-003-catálogo-referencial-sin-control-cuantitativo-estricto-de-stock-en-mvp) | Catálogo referencial sin control cuantitativo estricto de stock en MVP | **Confirmado** | 2026-11-15 |
| [DEC-004](#dec-004-desacoplamiento-de-título-respecto-a-ediciones-y-estados-de-conservación) | Desacoplamiento de título respecto a ediciones y estados de conservación | **Confirmado** | 2026-11-15 |
| [DEC-005](#dec-005-relación-muchos-a-muchos-entre-libros-y-proveedores-con-costos-variables) | Relación muchos a muchos entre libros y proveedores con costos variables | **Confirmado** | 2026-11-15 |
| [DEC-006](#dec-006-autorización-de-entrega-con-saldo-pendiente-de-cobro-fiado) | Autorización de entrega con saldo pendiente de cobro (fiado) | **Confirmado** | 2026-11-15 |
| [DEC-007](#dec-007-soporte-de-cierres-de-caja-offline-provisionales-con-conciliación-posterior) | Soporte de cierres de caja offline provisionales con conciliación posterior | **Confirmado** | 2026-11-15 |
| [DEC-008](#dec-008-exclusión-de-facturación-electrónica-en-mvp-con-diseño-extensible) | Exclusión de facturación electrónica en MVP con diseño extensible | **Confirmado** | 2026-11-15 |
| [DEC-009](#dec-009-arquitectura-offline-first-con-sqlite-local-y-supabase-remoto) | Arquitectura Offline-First con SQLite local y Supabase remoto | **Confirmado** | 2026-11-15 |
| [DEC-010](#dec-010-captura-asistida-de-libros-mediante-fotografía-y-ocr) | Captura asistida de libros mediante fotografía y OCR | **Confirmado** | 2026-11-15 |
| [DEC-011](#dec-011-modalidad-de-venta-rápida-con-foto-y-detalle-pendiente-de-completar) | Modalidad de venta rápida con foto y detalle pendiente de completar | **Confirmado** | 2026-11-15 |
| [DEC-012](#dec-012-selección-del-motor-y-estrategia-de-sincronización-offline) | Selección del motor y estrategia de sincronización offline | **Pendiente de decisión** | 2026-11-15 |
| [DEC-013](#dec-013-selección-de-la-tecnología-de-reconocimiento-ocr) | Selección de la tecnología de reconocimiento OCR | **Pendiente de decisión** | 2026-11-15 |
| [DEC-014](#dec-014-orquestador-de-monorepo-turborepo--pnpm) | Orquestador de monorepo: Turborepo + pnpm | **Propuesto** | 2026-11-15 |
| [DEC-015](#dec-015-estrategia-de-cifrado-de-base-de-datos-local-sqlite) | Estrategia de cifrado de base de datos local SQLite | **Pendiente de decisión** | 2026-11-15 |

---

## Detalle de Decisiones Confirmadas

### DEC-001: Alcance inicial restringido a tienda única
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** El negocio opera actualmente una única sede física. Diseñar un esquema multisede o con transferencias complejas de almacenes incrementaría drásticamente la complejidad del modelo de datos y la sincronización offline.
- **Decisión:** La arquitectura del MVP modelará la operación de una sola tienda física.
- **Justificación:** Reduce el *time-to-market*, simplifica el esquema de caja única y disminuye el riesgo de conflictos de sincronización.
- **Consecuencias:** En el modelo relacional no se requerirá particionado por `tienda_id` en el MVP, pero se mantendrá modularidad para incorporar multitienda en versiones futuras si el negocio se expande.

### DEC-002: Estrategia de plataforma: Android primero y panel web posterior
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** La urgencia operativa radica en el mostrador de ventas físicas y la movilidad dentro de la librería para catalogar libros con cámara fotográfica.
- **Decisión:** Priorizar el desarrollo de la aplicación móvil en React Native / Expo sobre plataforma Android. El panel de administración web en React se abordará en una fase posterior.
- **Justificación:** Los dispositivos de mostrador y teléfonos del personal son Android, donde se requiere acceso a hardware (cámara, almacenamiento local, modo offline).
- **Consecuencias:** La lógica de negocio y las llamadas a base de datos deben aislarse en paquetes compartidos dentro del monorepo para permitir su reutilización directa cuando se desarrolle la aplicación web.

### DEC-003: Catálogo referencial sin control cuantitativo estricto de stock en MVP
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** En librerías independientes y de segunda mano, realizar inventarios periódicos exactos y mantener un control de stock en tiempo real es una barrera de adopción crítica que suele retrasar la digitalización.
- **Decisión:** En el MVP, el catálogo funcionará de manera referencial. No se bloquearán ventas por "stock cero" ni se forzará un kardex cuantitativo continuo.
- **Justificación:** Priorizar la agilidad del registro de ventas y la catalogación ágil sobre la rigidez de inventarios.
- **Consecuencias:** No habrá transacciones complejas de decremento de inventario con bloqueos concurrentes en el MVP. La validación de existencia es visual por el vendedor. El kardex cuantitativo se planifica para una fase futura.

### DEC-004: Desacoplamiento de título respecto a ediciones y estados de conservación
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** Un mismo libro (por ejemplo, *Cien años de soledad*) puede encontrarse en ediciones distintas (editorial, año, formato) y en condiciones físicas diversas (nuevo vs. usado), lo que altera sustancialmente su precio y costo.
- **Decisión:** Modelar una entidad `libros` (información bibliográfica base) relacionada con una o más `ediciones_libro` (edición, formato, estado: nuevo/usado, precio referencial, carátula).
- **Justificación:** Evita la duplicación de datos bibliográficos generales y permite registrar de forma clara la variabilidad de precios según el estado de conservación.
- **Consecuencias:** Las líneas de venta y compras deben referenciar a `ediciones_libro` y no únicamente al título genérico.

### DEC-005: Relación muchos a muchos entre libros y proveedores con costos variables
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** Las librerías adquieren libros de distintas editoriales, distribuidores independientes o particulares (libros usados), variando los costos de compra y plazos de entrega.
- **Decisión:** Implementar una tabla intermedia (`libro_proveedor`) que registre costos referenciales y códigos de proveedor por cada edición de libro.
- **Justificación:** Permite comparar opciones de abastecimiento y mantener un historial de costos de adquisición.
- **Consecuencias:** El módulo de pedidos a proveedores debe permitir seleccionar el proveedor sugerido o cotizar con múltiples distribuidores.

### DEC-006: Autorización de entrega con saldo pendiente de cobro (fiado)
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** Es práctica común en librerías de confianza o clientes frecuentes entregar libros con un pago parcial, quedando un saldo pendiente de liquidación.
- **Decisión:** El sistema admitirá ventas con saldo pendiente y entrega física del producto, siempre y cuando cuente con la autorización explícita de un rol con jerarquía (Dueño o Administrador).
- **Justificación:** Formaliza la práctica comercial real sin generar descalces ciegos en caja, manteniendo la trazabilidad de cuentas por cobrar.
- **Consecuencias:** La entidad `ventas` debe registrar `saldo_pendiente`, `estado_pago` (Parcial/Pendiente), `estado_entrega` (Entregado con saldo pendiente) y `autorizador_id`.

### DEC-007: Soporte de cierres de caja offline provisionales con conciliación posterior
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** Si la jornada laboral concluye y no hay internet en el local, el vendedor debe poder realizar el arqueo y registrar el cierre de caja en el dispositivo.
- **Decisión:** Se permite el cierre de sesión de caja en modo offline con estado `Cierre Provisorio Offline`. Al reconectar con Supabase, el sistema lo marcará como pendiente de conciliación o lo conciliará automáticamente según reglas auditables.
- **Justificación:** Evita dejar cajas abiertas por falta de conectividad y previene la mezcla de operaciones entre turnos o días consecutivos.
- **Consecuencias:** Se requiere una máquina de estados de caja con soporte para estados provisionales y un flujo de conciliación en el panel administrativo.

### DEC-008: Exclusión de facturación electrónica en MVP con diseño extensible
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** La facturación electrónica con entidades tributarias (ej. SUNAT u homólogos) introduce complejidades regulatorias, certificados digitales e integraciones SOAP/REST que dilatan el MVP.
- **Decisión:** El MVP emitirá notas de venta / comprobantes internos de mostrador. La arquitectura desacoplará el evento de venta para que en fases posteriores pueda conectarse un emisor de comprobantes electrónicos.
- **Justificación:** Foco en la operatividad comercial interna antes de la homologación fiscal.
- **Consecuencias:** Las tablas de venta contendrán campos preparados (tipo de documento fiscal, serie, correlativo tributario futuro nullable) para facilitar la transición sin refactorizaciones destructivas.

### DEC-009: Arquitectura Offline-First con SQLite local y Supabase remoto
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** El punto de venta en mostrador no tolera caídas por latencia o falta de internet.
- **Decisión:** Toda la aplicación móvil escribirá y leerá directamente en una base de datos local SQLite. La sincronización con Supabase (PostgreSQL) se efectuará de forma asíncrona en segundo plano.
- **Justificación:** Garantiza latencia cero (<100ms en UI), resiliencia total y desacoplamiento frente a problemas de conectividad.
- **Consecuencias:** Todos los identificadores primarios deben ser UUID v4 generados en el cliente para evitar colisiones de clave primaria al sincronizar.

### DEC-010: Captura asistida de libros mediante fotografía y OCR
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** El registro manual de libros con datos bibliográficos extensos es lento y propenso a errores tipográficos.
- **Decisión:** Integrar capacidad de captura fotográfica en la app móvil que procese mediante OCR el texto de la portada o contraportada para prellenar título, autor, editorial e ISBN.
- **Justificación:** Reduce el tiempo de catalogación de minutos a segundos por libro, facilitando la adopción por parte del personal.
- **Consecuencias:** Se requiere un flujo de prellenado con validación humana obligatoria antes de confirmar el alta en el catálogo.

### DEC-011: Modalidad de venta rápida con foto y detalle pendiente de completar
- **Estado:** Confirmado
- **Fecha:** 2026-11-15
- **Contexto:** En momentos de alta congestión de clientes, ingresar ítem por ítem en el POS puede ocasionar pérdidas de ventas.
- **Decisión:** Permitir registrar una "Venta Rápida" ingresando el monto total cobrado, medio de pago y una fotografía de los libros vendidos o del ticket, quedando en estado `Pendiente de Regularización` para su desglose posterior.
- **Justificación:** Prioriza el flujo de caja y la atención al cliente sobre el registro detallado inmediato.
- **Consecuencias:** El sistema debe contar con una bandeja de ventas pendientes de regularización que alerte al personal para asociar los libros correspondientes antes del cierre definitivo.

---

## Decisiones Propuestas y Pendientes (Sujetas a Resolución Técnica)

> [!NOTE]
> Las siguientes decisiones representan alternativas técnicas en evaluación. No son vinculantes ni definitivas en esta fase y deberán resolverse formalmente en los hitos correspondientes de arquitectura (H02) y hardening (H04) antes de iniciar la implementación en H06.

### DEC-012: Selección del motor y estrategia de sincronización offline
- **Estado:** Pendiente de decisión (Hito de resolución: **H02**)
- **Fecha:** 2026-11-15
- **Contexto:** Se requiere replicar datos bidireccionalmente entre SQLite (móvil) y Supabase (PostgreSQL remota) gestionando desconexiones, reconexiones y resolución de conflictos.
- **Opciones en evaluación:**
  1. *PowerSync:* Solución especializada para SQLite <-> Supabase con sincronización reactiva por streams.
  2. *WatermelonDB:* Capa de datos reactiva para React Native con adaptadores de sincronización REST/Supabase.
  3. *Motor propietario basado en Outbox Pattern sobre expo-sqlite:* Cola de mutaciones locales y tabla de sync_log propia.
- **Criterio de decisión:** Facilidad de integración con Expo, soporte de TypeScript, mantenimiento de la comunidad y robustez ante conflictos.

### DEC-013: Selección de la tecnología de reconocimiento OCR
- **Estado:** Pendiente de decisión (Hito de resolución: **H02**)
- **Fecha:** 2026-11-15
- **Contexto:** El OCR debe operar preferentemente de forma autónoma o tolerante a baja conectividad.
- **Opciones en evaluación:**
  1. *Google ML Kit Text Recognition (On-device):* Procesamiento local sin consumo de cuotas de red, ideal para operación offline en Android.
  2. *Google Cloud Vision API / Supabase Edge Functions:* Mayor precisión pero requiere conectividad activa a internet.
  3. *Híbrido:* On-device para extracción primaria con opción de enriquecimiento cloud cuando haya red.
- **Criterio de decisión:** Compatibilidad con Expo, desempeño en dispositivos Android de gama media y comportamiento sin red.

### DEC-014: Orquestador de monorepo: Turborepo + pnpm
- **Estado:** Propuesto (Hito de resolución: **H02**)
- **Fecha:** 2026-11-15
- **Contexto:** Se estructurará un monorepo para alojar la app móvil (`apps/mobile`), la futura web (`apps/web`) y paquetes compartidos (`packages/shared-types`, `packages/database`, etc.).
- **Propuesta:** Utilizar `pnpm` como gestor de paquetes con *workspaces* y `Turborepo` como pipeline de compilación y caché de tareas.
- **Justificación:** Alta velocidad de instalación mediante enlaces duros de pnpm y optimización de builds compartidos.

### DEC-015: Estrategia de cifrado de base de datos local SQLite
- **Estado:** Pendiente de decisión (Hito de resolución: **H04**)
- **Fecha:** 2026-11-15
- **Contexto:** En dispositivos móviles corporativos o personales, los datos de ventas, clientes y caja almacenados en SQLite podrían ser expuestos si el dispositivo es sustraído o rooteado.
- **Opciones en evaluación:**
  1. Cifrado completo de la base de datos local con SQLCipher / `expo-sqlite` cifrado.
  2. Cifrado a nivel de campos sensibles (datos personales, tokens) almacenando las claves criptográficas en Android Keystore mediante `expo-secure-store`.
  3. Delegación en el cifrado a nivel de sistema de archivos de Android (FBE - File-Based Encryption).
- **Criterio de decisión:** Impacto en el rendimiento de consultas locales, compatibilidad con Expo Config Plugins y complejidad de recuperación de llaves.
