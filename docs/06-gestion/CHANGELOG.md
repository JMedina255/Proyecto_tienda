# Registro de Cambios (CHANGELOG.md)

Todas las modificaciones notables en este proyecto serán documentadas en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
