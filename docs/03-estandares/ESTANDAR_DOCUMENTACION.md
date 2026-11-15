# Estándar de Documentación Técnica (ESTANDAR_DOCUMENTACION.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda<br>
**Documento:** ESTANDAR_DOCUMENTACION.md<br>
**Estado:** Vigente / Aprobado en H01.1<br>
**Trazabilidad:** [../../AGENTS.md](../../AGENTS.md) | [../05-planificacion/PLAN_DESARROLLO.md](../05-planificacion/PLAN_DESARROLLO.md)

---

## 1. Principios Fundamentales

1. **Claridad y Concisión:** Priorizar redacción directa, técnica y verificable. Eliminar introducciones extensas, prosa ornamental y adjetivos subjetivos.
2. **Alta Densidad de Información:** Preferir tablas estructuradas sobre párrafos narrativos extensos para requisitos, reglas de negocio y matrices de trazabilidad.
3. **No Duplicación (Single Source of Truth):** Cada concepto, regla o requerimiento se define en un único documento fuente. Los demás documentos deben referenciarlo mediante enlaces relativos en lugar de copiar su texto.
4. **Mantenibilidad:** La documentación debe ser ágil de actualizar conforme el código evoluciona, evitando estructuras redundantes que generen inconsistencias en revisiones futuras.
5. **Completitud sin Relleno:** Favorecer documentos concisos sin imponer límites arbitrarios de líneas que fuercen la omisión de criterios de aceptación, excepciones o detalles de seguridad indispensables.

---

## 2. Estructura y Formato Markdown

- **Encabezado estándar:** Todo documento técnico debe iniciar con título H1 (`#`), metadatos breves (Proyecto, Documento, Estado, Trazabilidad) y un separador horizontal (`---`).
- **Encabezados:** Jerarquía limpia (`#`, `##`, `###`). No saltar niveles (ej. no usar `####` directamente bajo `##`).
- **Tablas:** Formato estándar GFM con alineación explícita (`:---` izquierda, `:---:` centro, `---:` derecha).
- **Listas:** Viñetas simples (`-`) para enumeraciones y listas numeradas (`1.`) para secuencias temporales obligatorias.
- **Alertas GitHub:** Usar `> [!NOTE]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` con moderación para destacar reglas críticas o decisiones pendientes.

---

## 3. Identificadores y Trazabilidad

Todos los artefactos deben utilizar códigos unívocos estables:

| Prefijo | Tipo de Artefacto | Ejemplo | Ubicación Principal |
| :--- | :--- | :--- | :--- |
| `RF-[MOD]-[NUM]` | Requerimiento Funcional | `RF-VTA-001` | `docs/01-requerimientos/SRS.md` |
| `RNF-[CAT]-[NUM]` | Requerimiento No Funcional | `RNF-PERF-001` | `docs/01-requerimientos/SRS.md` |
| `RN-[DOM]-[NUM]` | Regla de Negocio | `RN-PAG-002` | `docs/01-requerimientos/REGLAS_NEGOCIO.md` |
| `CU-[MOD]-[NUM]` | Caso de Uso | `CU-VTA-01` | `docs/01-requerimientos/SRS.md` |
| `DEC-[NUM]` | Decisión de Arquitectura | `DEC-006` | `docs/06-gestion/DECISIONES.md` |
| `SEC-[DOM]-[NUM]` | Control de Seguridad | `SEC-AUTH-001` | `docs/04-seguridad/HARDENING.md` |

- **Inmutabilidad de IDs:** Una vez asignado un identificador, no se renombra ni se reutiliza para otro propósito.
- **Trazabilidad:** Todo cambio funcional debe mantener actualizada la matriz de trazabilidad: `RF → RN → CU → Criterio → Prioridad`.

---

## 4. Tablas y Diagramas

- **Tablas para Requisitos:** Estructurar requisitos en tablas con columnas: `ID`, `Descripción`, `Actor`, `Prioridad`, `Regla Vinculada`, `Criterio de Aceptación / Verificación`, `Excepción`.
- **Casos de Uso Compactos:** Documentar casos de uso con: Objetivo, Actores, Precondiciones, Flujo Principal numerado, Alternativas/Excepciones y Criterio Gherkin. No repetir texto de requisitos.
- **Diagramas Mermaid:**
  - Incluir diagramas únicamente cuando aporten claridad visual que una tabla no logre (flujos de procesos complejos, máquinas de estado, relaciones entidad-relación).
  - Validar compatibilidad nativa con GitHub (`flowchart TD/LR`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`).
  - Eliminar diagramas que dupliquen flujos ya expresados claramente en tablas.

---

## 5. Distinción entre Estados de Madurez

En todo documento debe quedar inequívoca la diferencia entre:
- **Confirmado / Aprobado:** Definición acordada y vinculante para el diseño y desarrollo.
- **Propuesto / Pendiente:** Alternativa técnica o regla sugerida que requiere validación previa de los interesados (ej. `DEC-016`, `RN-VTA-004`). No debe tratarse como restricción obligatoria hasta su confirmación.
- **Fuera de Alcance / Futuro:** Funcionalidades reservadas para fases posteriores (ej. facturación electrónica, multitienda, kardex cuantitativo).

---

## 6. Control de Cambios y Versionado Documental

1. Cada modificación relevante de contenido debe registrarse en `docs/06-gestion/CHANGELOG.md` bajo el hito correspondiente.
2. Todo hito concluido debe reflejar su estado actualizado en `docs/README.md`, `README.md` y `docs/05-planificacion/PLAN_DESARROLLO.md`.
3. Antes de confirmar un cambio documental, se debe verificar la integridad de enlaces relativos (`.md`), ausencia de credenciales y consistencia numérica exacta de elementos declarados vs. desarrollados.
