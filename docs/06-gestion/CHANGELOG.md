# Registro de Cambios (CHANGELOG.md)

Todas las modificaciones notables en este proyecto serán documentadas en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.7] - 2026-11-15 (Hito H02.1 — Correcciones Críticas de Arquitectura)

### Añadido
- **Controles de Seguridad Reforzados (`docs/04-seguridad/HARDENING.md`):**
  - Incorporación de `SEC-AUTHZ-004` (Autorización offline de operaciones sensibles con caducidad de credenciales en caché, lista de revocación local y auditoría criptográfica HMAC).
  - Incorporación de `SEC-SYNC-003` (Mínimo privilegio en funciones RPC de Supabase, exigiendo `SECURITY INVOKER` o `SECURITY DEFINER` con `search_path`, validación de `auth.uid()` y roles).
- **Registro de Nuevas Propuestas Técnicas (`docs/06-gestion/DECISIONES.md`):**
  - Registro formal de `DEC-017` (Período de gracia de 7 días para caducidad de sesiones offline) y `DEC-018` (Política de exclusividad de sesión de caja por dispositivo físico), manteniéndolas en estado `Propuesto` pendiente de decisión.

### Corregido
- **Durabilidad y Persistencia en SQLite (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Análisis comparativo de `PRAGMA synchronous = NORMAL` frente a `FULL` en modo WAL. Establecimiento de política estricta de `synchronous = FULL` para transacciones financieras críticas (ventas, cobros, caja) garantizando persistencia física (*fsync*) ante apagados súbitos o caídas del SO.
- **Seguridad en Funciones RPC de Supabase (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Mitigación del riesgo de bypass de RLS en funciones RPC, priorizando `SECURITY INVOKER` y restringiendo privilegios de ejecución en PostgreSQL.
- **Requerimientos Nativos y Disponibilidad Offline de OCR (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Documentación obligatoria de Expo Development Builds / Prebuild para Google ML Kit y configuración de empaquetado del modelo en el manifiesto nativo para disponibilidad 100% offline tras la instalación.
- **Sustitución de Garantías por Objetivos de Rendimiento (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Reemplazo de afirmaciones categóricas de latencia por metas cuantitativas formalmente sujetas a pruebas empíricas de benchmark en hardware Android representativo.
- **Reordenamiento Estratégico del Plan de Desarrollo (`docs/05-planificacion/PLAN_DESARROLLO.md`):**
  - Reestructuración de la fase H06 para construir la infraestructura base de sincronización, outbox e idempotencia antes del desarrollo de ventas y caja (H08), eliminando retrabajos arquitectónicos.
- **Registro Explícito de Riesgos Técnicos (`docs/06-gestion/DECISIONES.md`):**
  - Documentación de riesgos técnicos y medidas de mitigación para las opciones recomendadas en `DEC-012`, `DEC-013`, `DEC-014` y `DEC-015`.

---

## [0.0.6] - 2026-11-15 (Hito H02 — Arquitectura del Sistema y Estrategia Offline-First)

### Añadido
- **Consolidación del Documento de Arquitectura (`docs/02-arquitectura/ARQUITECTURA.md`):**
  - Diagrama general de arquitectura en Mermaid con capas del cliente móvil Android, canal seguro TLS 1.3, backend Supabase y panel web administrativo.
  - Especificación formal de la organización del Monorepo con `pnpm workspaces` y `Turborepo` (`apps/mobile`, `apps/web`, `packages/shared-types`, `packages/business-logic`, `packages/database`, `packages/sync-engine`).
  - Arquitectura móvil por módulos funcionales (*feature-based*) con separación estricta entre presentación (UI), hooks, servicios de dominio y repositorios de persistencia.
  - Integración técnica detallada con Supabase: GoTrue Auth (sesión persistida en Android Keystore con `expo-secure-store`, expiración offline tras 7 días), PostgreSQL con RLS y RPCs transaccionales (`rpc_push_mutations`, `rpc_pull_deltas`), y buckets de Supabase Storage para archivos multimedia.
  - Pipeline de medios y captura asistida: almacenamiento local inmediato en sandbox, inferencia OCR on-device con Google ML Kit (`@react-native-ml-kit/text-recognition`) en <300ms, y subida asíncrona desacoplada (`PhotoUploadWorker`).
  - Estrategia integral de sincronización offline con patrón Outbox, idempotencia basada en UUID v4 y claves hash (`idempotency_key`), backoff exponencial con jitter y modelo de Libro Mayor Append-Only (aditivo e inmutable) que veta *Last-Write-Wins* en ventas, cobros y caja.
  - Protocolo de cierres de caja provisionales offline y conciliación contable en servidor (`DEC-007`, `RN-CAJ-004`).
  - Diagramas de secuencia esenciales: ciclo de sincronización Outbox e idempotencia, y conciliación de cierres de caja provisorios.
  - Matriz de evaluación tecnológica y recomendaciones justificadas para `DEC-012`, `DEC-013`, `DEC-014` y `DEC-015`.
- **Registro de Decisiones Arquitectónicas (`docs/06-gestion/DECISIONES.md`):**
  - Actualización de `DEC-012` (Recomendación: Outbox sobre `expo-sqlite`), `DEC-013` (Recomendación: Solución Híbrida con Google ML Kit on-device), `DEC-014` (Recomendación: pnpm + Turborepo) y `DEC-015` (Recomendación: Cifrado Híbrido con Keystore y campos sensibles), manteniéndolas en estado `Propuesto (Recomendado en H02)` sin confirmación arbitraria.

### Cambiado
- **Actualización de Gobernanza y Planificación:**
  - `docs/05-planificacion/PLAN_DESARROLLO.md`: Registro de H02 como completado y activación de H03 (Modelo y Diccionario de Datos).
  - `docs/README.md` y `README.md`: Actualización del estado de avance hacia el hito H03.

---

## [0.0.5] - 2026-11-15 (Hito H01.1 — Simplificación y Normalización Documental)

### Añadido
- **Estándar Permanente de Documentación (`docs/03-estandares/ESTANDAR_DOCUMENTACION.md`):**
  - Directrices obligatorias de brevedad, alta densidad informativa, tablas compactas, eliminación de narrativa ornamental, unicidad de fuente de verdad y estabilidad de identificadores.
- **Mandato en Directrices para Agentes (`AGENTS.md`):**
  - Incorporación de la Sección 10 que establece la obligatoriedad del cumplimiento de `ESTANDAR_DOCUMENTACION.md` para todos los agentes y desarrolladores en futuros hitos.

### Cambiado
- **Normalización y Síntesis del SRS (`docs/01-requerimientos/SRS.md`):**
  - Reducción de ~1,022 a ~442 líneas conservando el 100% del alcance funcional, 45 RFs en tablas modulares compactas, 14 CUs estructurados con flujos y criterios de aceptación, 4 diagramas Mermaid clave y matriz de trazabilidad completa.
- **Normalización y Síntesis de Reglas de Negocio (`docs/01-requerimientos/REGLAS_NEGOCIO.md`):**
  - Reducción de ~338 a ~135 líneas mediante catálogo tabular compacto, matrices de compatibilidad de estados y matriz RBAC por roles.
- **Subsanación de Inconsistencias Numéricas de H01:**
  - Reglas de negocio: Declaración unívoca y enumeración exacta de 27 reglas (26 confirmadas + 1 propuesta pendiente: `RN-VTA-004`).
  - Casos de uso: Declaración, desarrollo formal y trazabilidad 1 a 1 de exactamente 14 casos de uso (`CU-AUT-01`, `CU-CAT-01..02`, `CU-VTA-01..02`, `CU-PAG-01..02`, `CU-CAJ-01..03`, `CU-PED-01..02`, `CU-PRV-01`, `CU-GAS-01`).
- **Tratamiento de Políticas No Confirmadas:**
  - El umbral de descuento del 15% para el rol Vendedor se clasifica y documenta explícitamente como propuesta pendiente en `RN-VTA-004` y `DEC-016`, sin imponerse como regla obligatoria en el MVP.
- **Actualización de Gobernanza y Planificación:**
  - Actualización de `PLAN_DESARROLLO.md` (inclusión de H01.1, eliminación de bloque duplicado de H02), `docs/README.md` y `README.md`.

---

## [0.0.4] - 2026-11-15 (Hito H01 — Especificación Detallada del SRS y Reglas de Negocio)

### Añadido
- **Refinamiento Integral del SRS (`docs/01-requerimientos/SRS.md`):**
  - Especificación exhaustiva de 11 módulos funcionales y 45 requerimientos funcionales (`RF-AUT`, `RF-CAT`, `RF-OCR`, `RF-VTA`, `RF-PAG`, `RF-CAJ`, `RF-GAS`, `RF-PRV`, `RF-PED`, `RF-REP`, `RF-OFF`) estructurados con identificador, descripción verificable, actor, prioridad MVP/Futura, precondiciones, reglas vinculadas, criterios de aceptación y excepciones.
  - Especificación formal de 14 casos de uso (`CU-AUT-01`, `CU-CAT-01..02`, `CU-VTA-01..02`, `CU-PAG-01..02`, `CU-CAJ-01..03`, `CU-PED-01..02`, `CU-PRV-01`, `CU-GAS-01`) con flujos principales, alternativos, excepciones y criterios de aceptación Gherkin.
  - 4 diagramas Mermaid renderizables: flujo de ventas normales vs. rápidas, ciclo de sesiones de caja con cierres offline y conciliación, pedidos de faltantes con recepciones parciales, y mapa de actores y módulos.
  - Matriz de trazabilidad integral (`RF` → `RN` → `CU` → `Criterio` → `Prioridad`).
  - Registro de observaciones y directrices de modelado relacional para el hito H03.
- **Ampliación y Consolidación de Reglas de Negocio (`docs/01-requerimientos/REGLAS_NEGOCIO.md`):**
  - Catálogo formal ampliado a 26 reglas de negocio (`RN-ALC-001` a `RN-OFF-001`), incorporando reglas para registro sin ISBN y prevención de duplicados (`RN-CAT-004`), categorización temática (`RN-CAT-005`), protección de datos bancarios de proveedores (`RN-PRV-002`), pedidos de no catalogados por foto/texto libre (`RN-PED-003`), anticipos con mercadería retenida (`RN-PAG-004`), arqueo físico desglosado por medio de pago (`RN-CAJ-003`), y restricciones offline (`RN-OFF-001`).
  - Matriz de compatibilidad estricta entre estados de venta, pago y entrega física para evitar estados incompatibles.
  - Matriz de control de acceso basado en roles (RBAC) detallada por operación.
- **Registro de Decisiones Arquitectónicas (`docs/06-gestion/DECISIONES.md`):**
  - Incorporación de `DEC-016` (Propuesta de política de descuentos máximos delegados al rol Vendedor).

---

## [0.0.3] - 2026-11-15 (Hito H00.2 — Configuración Git, Publicación Inicial y Política de Versionado)

### Añadido
- **Control de Versiones y Configuración Remota:**
  - Inicialización del repositorio local Git en la rama `master`.
  - Vinculación con el repositorio remoto oficial en GitHub: `https://github.com/JMedina255/Proyecto_tienda.git`.
  - Creación del archivo `.gitignore` optimizado para monorepo (Expo/Android, Web, TypeScript, Supabase y protección de secretos).
- **Política Permanente de Versionado en `AGENTS.md`:**
  - Incorporación de la Sección 9 con 9 directrices obligatorias: commit identificable por hito importante, push mandatorio a remoto, formato Conventional Commits, prohibición de secretos, veto a `push --force` y merges destructivos, inspección con `git diff`, evolución atómica código-documentación y política de ramas.
- **Entregables Git en Plan de Desarrollo:**
  - Inclusión formal del entregable Git (commit + push a `origin/master`) por cada hito en `docs/05-planificacion/PLAN_DESARROLLO.md`.
- **Publicación Inicial:**
  - Publicación de la línea base documental consolidada (H00 y H00.1) en el repositorio remoto oficial.

---

## [0.0.2] - 2026-11-15 (Hito H00.1 — Auditoría y Consolidación Documental)

### Añadido
- **Consolidación de Reglas de Negocio:**
  - Tabla índice formal en `docs/01-requerimientos/REGLAS_NEGOCIO.md` que declara y enumera unívocamente las 18 reglas de negocio consolidadas (`RN-ALC-001` a `RN-FAC-001`) con sus dominios y decisiones asociadas.
- **Realineación del Plan de Desarrollo:**
  - Nueva secuencia formal de hitos en `docs/05-planificacion/PLAN_DESARROLLO.md`: H00 (Inicialización), H00.1 (Auditoría activa), H01 (SRS y Reglas detalladas), H02 (Arquitectura y Sync offline), H03 (Modelo y Diccionario de datos), H04 (Estándares y Hardening), H05 (Planificación técnica y criterios), H06 (Monorepo e inicio de implementación sujeto a aprobación), seguido de las fases de construcción (H07+).
- **Distinción Formal de Decisiones Arquitectónicas:**
  - En `docs/06-gestion/DECISIONES.md`, explicitación de hitos de resolución técnica para las decisiones pendientes y propuestas (`DEC-012`, `DEC-013`, `DEC-014` para resolver en H02; `DEC-015` para resolver en H04).

### Corregido
- **Inconsistencia Cuantitativa en Reglas de Negocio:**
  - Subsanada la discrepancia donde el informe previo mencionaba 15 reglas pero enumeraba 18. Se confirma, declara y documenta de forma unívoca un total de 18 reglas.
- **Verificación de Ubicación de Plan de Desarrollo:**
  - Confirmación de que `PLAN_DESARROLLO.md` existe única y exclusivamente en `docs/05-planificacion/PLAN_DESARROLLO.md`.
- **Alineación de Fases en Hardening:**
  - Ajuste en `docs/04-seguridad/HARDENING.md` para distinguir la fase de especificación (H04) de la fase de implementación técnica (H06+).
- **Actualización de Índices de Estado:**
  - Sincronización del estado actual en `README.md` y `docs/README.md` indicando H00.1 como hito activo y H01 como próximo hito.

---

## [0.0.1] - 2026-11-15 (Hito H00)

### Añadido
- **Fundación y Gobernanza Documental:**
  - `README.md` principal del proyecto con visión del negocio, objetivos, alcance, usuarios, tecnologías y arquitectura general.
  - `AGENTS.md` con instrucciones permanentes para agentes de desarrollo y LLMs: trazabilidad estricta, inmutabilidad de decisiones confirmadas, sincronización documental y política de secreto cero.
  - `docs/README.md` como índice maestro de documentos, estado de elaboración y protocolo de mantenimiento.
- **Requerimientos y Políticas de Negocio:**
  - `docs/01-requerimientos/SRS.md`: Especificación de Requerimientos de Software (IEEE 830 / ISO 29148) preliminar, con actores, requerimientos funcionales (`RF-xxx`), no funcionales (`RNF-xxx`) y casos de uso (`CU-xxx`) con criterios de aceptación en Gherkin.
  - `docs/01-requerimientos/REGLAS_NEGOCIO.md`: Catálogo formal de reglas de negocio (`RN-xxx`), restricciones por rol y máquinas de estado para Venta, Pago, Entrega, Caja y Pedidos a Proveedores con diagramas Mermaid.
- **Arquitectura y Modelo de Datos:**
  - `docs/02-arquitectura/ARQUITECTURA.md`: Diseño arquitectónico *Offline-First*, propuesta de Monorepo (`apps/mobile`, `apps/web`, `packages/shared-types`, `packages/sync-engine`), motor de replicación con patrón Outbox, pipeline de procesamiento OCR y diseño extensible para facturación electrónica futura.
  - `docs/02-arquitectura/MODELO_DATOS.md`: Esquema entidad-relación preliminar (Mermaid ERD), catálogo de entidades candidatas y principios de diseño relacional (UUID v4 descentralizado, auditoría UTC).
- **Estándares Técnicos y Diccionario:**
  - `docs/03-estandares/ESTANDAR_PROGRAMACION.md`: Guías y convenciones para TypeScript estricto, React Native/Expo, React, estructura modular, nomenclatura, testing y manejo de errores resiliente.
  - `docs/03-estandares/DICCIONARIO_DATOS.md`: Metodología estándar de documentación de campos, equivalencias de tipos entre PostgreSQL y SQLite, restricciones y catálogo inicial de tablas base.
- **Seguridad y Planificación:**
  - `docs/04-seguridad/HARDENING.md`: Línea base de seguridad y matriz de controles (`SEC-xxx`) clasificados estrictamente por estado (`Pendiente` para H00, sin declaraciones falsas de implementación).
  - `docs/05-planificacion/PLAN_DESARROLLO.md`: Plan de desarrollo estructurado en 10 hitos (H00 a H09), dependencias, entregables verificables y criterios de aceptación.
  - `docs/06-gestion/DECISIONES.md`: Registro de Decisiones de Arquitectura (ADR) con 11 decisiones confirmadas (`DEC-001` a `DEC-011`) y 4 propuestas/pendientes (`DEC-012` a `DEC-015`).

### Cambiado
- Ninguno (versión inicial del repositorio).

### Deprecado
- Ninguno.

### Eliminado
- Ninguno.

### Corregido
- Ninguno.

### Seguridad
- Establecimiento de la política de secreto cero en `AGENTS.md` y `HARDENING.md`.
- Verificación de ausencia de credenciales, tokens o datos sensibles en todos los artefactos documentales.
