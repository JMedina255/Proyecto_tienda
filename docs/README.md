# Índice General de Documentación — Proyecto Tienda

Este directorio centraliza la documentación arquitectónica, técnica, de requerimientos, seguridad y gestión del **Sistema de Gestión de Librería**.

---

## 1. Índice Maestro de Documentos

| Carpeta | Documento | Propósito / Alcance | Estado de Elaboración |
| :--- | :--- | :--- | :--- |
| `/` | [README.md](../README.md) | Visión general del negocio, objetivos, arquitectura de alto nivel y alcance. | **Estructura base consolidada** |
| `/` | [AGENTS.md](../AGENTS.md) | Directrices obligatorias, protocolos de calidad y trazabilidad para agentes y desarrolladores. | **Vigente / Activo** |
| `01-requerimientos/` | [SRS.md](01-requerimientos/SRS.md) | Especificación de Requerimientos de Software (IEEE 830 / ISO 29148): 11 módulos, 45 RFs, 14 CUs, RNF y matriz de trazabilidad. | **Consolidado / Refinado en H01** |
| `01-requerimientos/` | [REGLAS_NEGOCIO.md](01-requerimientos/REGLAS_NEGOCIO.md) | Políticas comerciales, reglas de mostrador, cajas, créditos, estados compatibles y RBAC (26 reglas catalogadas). | **Consolidado / Refinado en H01** |
| `02-arquitectura/` | [ARQUITECTURA.md](02-arquitectura/ARQUITECTURA.md) | Diseño de la solución, monorepo, estrategia *offline-first*, sincronización y pipeline de OCR. | **Estructura base / Sujeto a H02** |
| `02-arquitectura/` | [MODELO_DATOS.md](02-arquitectura/MODELO_DATOS.md) | Entidades candidatas, relaciones, esquema relacional preliminar y convenciones relacionales. | **Estructura base / Sujeto a H03** |
| `03-estandares/` | [ESTANDAR_PROGRAMACION.md](03-estandares/ESTANDAR_PROGRAMACION.md) | Convenciones de TypeScript, React Native, React, testing, estructura modular y linters. | **Estructura base / Sujeto a H04** |
| `03-estandares/` | [DICCIONARIO_DATOS.md](03-estandares/DICCIONARIO_DATOS.md) | Estructura formal y catálogo detallado de tablas, columnas, tipos, claves y restricciones. | **Estructura base / Sujeto a H03** |
| `04-seguridad/` | [HARDENING.md](04-seguridad/HARDENING.md) | Línea base de seguridad, RLS, cifrado local, protección de storage y controles de sincronización. | **Línea base / Sujeto a H04** |
| `05-planificacion/` | [PLAN_DESARROLLO.md](05-planificacion/PLAN_DESARROLLO.md) | Cronograma de fases e hitos (H00 a H06+), dependencias, criterios de aceptación y entregables Git. Ubicado exclusivamente en `docs/05-planificacion/`. | **Actualizado / Vigente H01** |
| `06-gestion/` | [DECISIONES.md](06-gestion/DECISIONES.md) | Registro de Decisiones de Arquitectura (ADR) con estados (Confirmado, Propuesto, Pendiente). | **Vigente / Actualizado H01** |
| `06-gestion/` | [CHANGELOG.md](06-gestion/CHANGELOG.md) | Historial de versiones del repositorio documental y técnico. | **Vigente / Versión 0.0.4** |

---

## 2. Convenciones de Estados Documentales

Cada documento o sección utiliza una clasificación explícita de madurez:

- **Estructura base / Plantilla:** Define la estructura, propósitos y secciones requeridas; listo para ser completado en el hito correspondiente.
- **Preliminar / Propuesto:** Contiene descripciones iniciales basadas en el levantamiento preliminar; sujeto a refinamiento y confirmación técnica.
- **Consolidado / Vigente:** Reglas o decisiones aprobadas por los interesados del proyecto que guían el desarrollo.
- **En revisión:** Modificaciones propuestas en proceso de validación.

---

## 3. Protocolo de Modificación y Versionado

1. Cualquier cambio en requerimientos o arquitectura debe generar un registro en [CHANGELOG.md](06-gestion/CHANGELOG.md).
2. Si una regla de negocio o requerimiento funcional se ajusta, debe actualizarse el documento fuente y todos los documentos dependientes (p. ej., si cambia un estado de pedido, actualizar `REGLAS_NEGOCIO.md`, `MODELO_DATOS.md` y `DICCIONARIO_DATOS.md`).
3. No se permiten documentos huérfanos sin enlaces desde este índice.
