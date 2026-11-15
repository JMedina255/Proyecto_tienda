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
| [DEC-012](#dec-012-selección-del-motor-y-estrategia-de-sincronización-offline) | Selección del motor y estrategia de sincronización offline | **Propuesto (Recomendado en H02)** | 2026-11-15 |
| [DEC-013](#dec-013-selección-de-la-tecnología-de-reconocimiento-ocr) | Selección de la tecnología de reconocimiento OCR | **Propuesto (Recomendado en H02)** | 2026-11-15 |
| [DEC-014](#dec-014-orquestador-de-monorepo-turborepo--pnpm) | Orquestador de monorepo: Turborepo + pnpm | **Propuesto (Recomendado en H02)** | 2026-11-15 |
| [DEC-015](#dec-015-estrategia-de-cifrado-de-base-de-datos-local-sqlite) | Estrategia de cifrado de base de datos local SQLite | **Propuesto (Recomendado en H02)** | 2026-11-15 |
| [DEC-016](#dec-016-política-de-descuentos-máximos-delegados) | Política de descuentos máximos delegados para el rol Vendedor | **Propuesto (Pendiente de decisión)** | 2026-11-15 |
| [DEC-017](#dec-017-período-de-gracia-para-caducidad-de-sesiones-offline) | Período de gracia para caducidad de sesiones offline | **Propuesto (Pendiente de decisión)** | 2026-11-15 |
| [DEC-018](#dec-018-política-de-exclusividad-de-sesión-de-caja-por-dispositivo) | Exclusividad de sesión de caja por dispositivo físico | **Propuesto (Pendiente de decisión)** | 2026-11-15 |

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
- **Estado:** Propuesto (Recomendado en H02 - Pendiente de aprobación formal)
- **Fecha:** 2026-11-15
- **Contexto:** Se requiere replicar datos bidireccionalmente entre SQLite local (`apps/mobile`) y PostgreSQL central en Supabase, garantizando autonomía total sin red y consistencia financiera estricta.
- **Alternativas Evaluadas:**
  1. *PowerSync (`@journeyapps/powersync-sdk-react-native`):* Replicación lógica reactiva basada en SQLite. Desventaja: requiere servicio intermediario (Docker self-hosted o cloud de pago) y no resuelve por sí solo las mutaciones ascendentes complejas.
  2. *WatermelonDB (`@nozbe/watermelondb`):* Base de datos reactiva con adaptadores propios. Desventaja: modelos fuertemente acoplados con decoradores, dificultad para compartir código con la futura web y mantenimiento histórico complejo en nuevas versiones de React Native.
  3. *Motor propietario basado en Outbox Pattern sobre `expo-sqlite`:* Cola local transaccional `sync_outbox`, funciones RPC transaccionales en PostgreSQL (`rpc_push_mutations`, `rpc_pull_deltas`) y llamadas HTTP REST/TLS.
- **Recomendación H02:** **Outbox Pattern propietario sobre `expo-sqlite`**.
- **Justificación:** Control total sobre las reglas anti-LWW en finanzas, soporte nativo en Expo sin dependencias C++ invasivas, costo cero de infraestructura intermediaria y máxima portabilidad hacia el futuro panel web.
- **Riesgos Técnicos Identificados:** Mayor esfuerzo inicial de desarrollo en la lógica de cola y reconciliación; riesgo de errores en la serialización JSON o manejo de reintentos.
- **Mitigación Arquitectónica:** Construir la infraestructura base de sincronización e idempotencia en H06 antes de desarrollar las capas de ventas y caja (ref: [PLAN_DESARROLLO.md](../05-planificacion/PLAN_DESARROLLO.md)).
- **Referencias:** [ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md#6-estrategia-de-sincronización-offline-first), [SRS.md](../01-requerimientos/SRS.md#rf-off-001-a-rf-off-004).

### DEC-013: Selección de la tecnología de reconocimiento OCR
- **Estado:** Propuesto (Recomendado en H02 - Pendiente de aprobación formal)
- **Fecha:** 2026-11-15
- **Contexto:** El registro de libros en mostrador mediante fotografía exige reconocimiento de texto (portada, contraportada, ISBN) con respuesta inmediata y tolerancia total a desconexión.
- **Alternativas Evaluadas:**
  1. *Google ML Kit Text Recognition On-Device (`@react-native-ml-kit/text-recognition`):* Inferencia local en procesador móvil. Ventaja: 100% offline, costo cero, privacidad de datos.
  2. *Cloud Vision API (Google Cloud / Azure / Supabase Edge Functions):* Envío de imagen a la nube. Desventaja: 0% offline, latencia de red, costo por petición.
  3. *Solución Híbrida:* Inferencia on-device con ML Kit como motor primario offline, complementada con consulta a APIs bibliográficas abiertas (Open Library / Google Books) no bloqueante cuando haya red.
- **Recomendación H02:** **Solución Híbrida con Google ML Kit On-Device primario**.
- **Justificación:** Catalogación instantánea en mostrador sin red (`RF-OCR-001`), costo cero y enriquecimiento progresivo opcional.
- **Riesgos Técnicos Identificados:** Requiere Expo Prebuild y Development Builds (incompatible con Expo Go genérico); incremento de 30-40 MB en el APK; posible fallo si el modelo intenta descargarse en primer uso sin red.
- **Mitigación Arquitectónica:** Empaquetar el modelo en el manifiesto (`<meta-data ... android:value="ocr" />`) mediante Config Plugin y validar compilación nativa en EAS (ref: [ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md#52-pipeline-de-captura-fotográfica-y-ocr-on-device)).
- **Referencias:** [ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md#52-pipeline-de-captura-fotográfica-y-ocr-on-device), [SRS.md](../01-requerimientos/SRS.md#módulo-3-captura-asistida-por-ocr).

### DEC-014: Orquestador de monorepo: Turborepo + pnpm
- **Estado:** Propuesto (Recomendado en H02 - Pendiente de aprobación formal)
- **Fecha:** 2026-11-15
- **Contexto:** Se requiere estructurar el repositorio para alojar `apps/mobile`, `apps/web` y librerías compartidas (`packages/*`).
- **Alternativas Evaluadas:**
  1. *pnpm Workspaces + Turborepo:* Enlaces duros, ahorro de disco y caché incremental determinista.
  2. *npm Workspaces:* Solución por defecto. Desventaja: consumo excesivo de disco y carencia de pipeline con caché.
- **Recomendación H02:** **pnpm Workspaces + Turborepo**.
- **Justificación:** Estándar moderno para monorepos React Native + Web, optimiza tiempos de CI/CD y tipado compartido.
- **Riesgos Técnicos Identificados:** Incompatibilidades ocasionales de resolución de dependencias (*hoisting*) en Metro Bundler de React Native con symlinks de pnpm.
- **Mitigación Arquitectónica:** Configurar `node-linker=hoisted` en `.npmrc` y configurar `metro.config.js` con soporte para mono-repositorios (ref: [ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md#2-organización-del-monorepo)).
- **Referencias:** [ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md#2-organización-del-monorepo).

### DEC-015: Estrategia de cifrado de base de datos local SQLite
- **Estado:** Propuesto (Recomendado en H02 - Pendiente de aprobación formal)
- **Fecha:** 2026-11-15
- **Contexto:** Proteger datos comerciales y sensibles en dispositivos móviles de mostrador ante sustracción o rooteo.
- **Alternativas Evaluadas:**
  1. *SQLCipher (Cifrado completo de base de datos a nivel de página):* Desventaja: sobrecarga de I/O, configuración nativa compleja y riesgo de pérdida total si se corrompe la clave en Keystore.
  2. *Cifrado Híbrido (Protección de sandbox SO Android FBE + Android Keystore con `expo-secure-store` para campos sensibles):* SQLite reside en almacenamiento privado interno; tokens JWT, PINs y cuentas bancarias de proveedores (`RN-PRV-002`) se cifran con AES-256 antes de persistir.
  3. *Solo Sandbox del SO Android:* Desventaja: vulnerable en equipos rooteados con depuración ADB activa.
- **Recomendación H02:** **Cifrado Híbrido (Protección de Sandbox SO + Android Keystore con `expo-secure-store`)**.
- **Justificación:** Cumple `SEC-DAT-001` y `SEC-DAT-002`, mantiene el rendimiento de SQLite sin sobrecarga I/O y elimina la fragilidad operacional de SQLCipher.
- **Riesgos Técnicos Identificados:** Datos de catálogo o notas de venta no confidenciales quedan accesibles en la base de datos si un atacante rootea el dispositivo e inspecciona el sandbox.
- **Mitigación Arquitectónica:** Limitar los datos almacenados localmente a lo indispensable para la operación de mostrador y cifrar todos los campos que contengan datos personales o financieros.
- **Referencias:** [ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md#8-matriz-de-evaluación-tecnológica), [HARDENING.md](../04-seguridad/HARDENING.md).

### DEC-016: Política de descuentos máximos delegados
- **Estado:** Propuesto (Pendiente de decisión del Dueño / Interesados)
- **Fecha:** 2026-11-15
- **Contexto:** Se requiere proteger los márgenes comerciales de la librería sin entorpecer la agilidad del regateo o promociones de mostrador. En H01.1 se identificó que el umbral del 15% no ha sido confirmado formalmente por el usuario.
- **Propuesta:** Permitir al rol `Vendedor` aplicar hasta un 15% de descuento sobre el precio referencial de forma autónoma. Descuentos superiores o modificaciones drásticas de precio exigirían confirmación o PIN del `Dueño` o `Administrador` (ref: propuesta `RN-VTA-004`).
- **Alternativa:** Mantener libertad total de edición de precios para el vendedor sin umbrales técnicos rígidos y auditar a posteriori mediante reportes comparativos de precio de venta vs. precio referencial.
- **Criterio de decisión:** No se impondrá como regla obligatoria en el MVP hasta que el Dueño decida formalmente si prefiere control previo (límite porcentual) o control posterior (auditoría).

### DEC-017: Período de gracia para caducidad de sesiones offline
- **Estado:** Propuesto (Pendiente de decisión del Dueño / Interesados)
- **Fecha:** 2026-11-15
- **Contexto:** Se requiere balancear la seguridad de acceso a la aplicación frente a la tolerancia a fallas prolongadas de internet en el local físico.
- **Propuesta:** Permitir la operación continua en modo offline hasta por **7 días calendario** sin reconexión a Supabase Auth. Trascurrido dicho plazo sin renovar el Refresh Token, se bloqueará la emisión de nuevas ventas hasta restablecer contacto con el servidor.
- **Alternativa:** Períodos de gracia más cortos (24 a 48 horas) o más extensos (15 a 30 días), evaluando el riesgo de que un empleado dado de baja continúe operando localmente vs. el riesgo de paralización por cortes de red prolongados.
- **Criterio de decisión:** Definición del umbral por el Dueño y Administrador en función de la estabilidad de la red local.

### DEC-018: Política de exclusividad de sesión de caja por dispositivo
- **Estado:** Propuesto (Pendiente de decisión del Dueño / Interesados)
- **Fecha:** 2026-11-15
- **Contexto:** En operaciones offline, si múltiples dispositivos abren simultáneamente sesiones de caja con el mismo fondo inicial, se generan descuadres contables en la conciliación.
- **Propuesta:** Restringir la apertura de sesión de caja a un único terminal físico activo a la vez (asociando `sesion_caja_id` con `dispositivo_id` unívoco en SQLite).
- **Alternativa:** Permitir cajas simultáneas por terminal físico independiente, exigiendo que cada dispositivo cuente con su propio arqueo y fondo de apertura diferenciado.
- **Criterio de decisión:** Definición del modelo operativo de mostrador (¿un solo teléfono/POS cobra en efectivo o múltiples vendedores tienen cajones independientes?).
