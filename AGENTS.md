# Instrucciones Permanentes para Agentes de Desarrollo (AGENTS.md)

Este documento define el protocolo de comportamiento, directrices de calidad y restricciones operativas obligatorias para cualquier agente de inteligencia artificial o desarrollador que colabore en el proyecto **Sistema de Gestión de Librería**.

Cualquier intervención en el repositorio debe apegarse estrictamente a estas directrices.

---

## 1. Principio de Revisión Documental Previa

Antes de proponer o ejecutar cualquier cambio en código, estructura de datos, dependencias o configuración:

1. **Lectura obligatoria:** Consultar los documentos relevantes en el directorio [`docs/`](docs/README.md).
2. **Alineación con decisiones:** Verificar si la tarea impacta decisiones ya registradas en [`docs/06-gestion/DECISIONES.md`](docs/06-gestion/DECISIONES.md).
3. **Validación de reglas:** Contrastar la lógica a implementar contra [`docs/01-requerimientos/REGLAS_NEGOCIO.md`](docs/01-requerimientos/REGLAS_NEGOCIO.md).
4. Si se detecta una contradicción entre la solicitud del usuario y la documentación aprobada, **detenerse y advertir al usuario** antes de proceder.

---

## 2. Trazabilidad Rigurosa entre Requerimientos y Código

Todo artefacto técnico (archivo, función, migración, componente de interfaz o caso de prueba) debe ser trazable a los identificadores del proyecto:

- **Requerimientos Funcionales:** `RF-xxx` (definidos en [`docs/01-requerimientos/SRS.md`](docs/01-requerimientos/SRS.md)).
- **Requerimientos No Funcionales:** `RNF-xxx` (definidos en [`docs/01-requerimientos/SRS.md`](docs/01-requerimientos/SRS.md)).
- **Reglas de Negocio:** `RN-xxx` (definidas en [`docs/01-requerimientos/REGLAS_NEGOCIO.md`](docs/01-requerimientos/REGLAS_NEGOCIO.md)).
- **Decisiones de Arquitectura:** `DEC-xxx` (definidas en [`docs/06-gestion/DECISIONES.md`](docs/06-gestion/DECISIONES.md)).
- **Controles de Seguridad:** `SEC-xxx` (definidos en [`docs/04-seguridad/HARDENING.md`](docs/04-seguridad/HARDENING.md)).

Al escribir código o tests, incluir comentarios que hagan referencia explícita al identificador correspondiente (por ejemplo: `// Implementa RF-VTA-002 y RN-VTA-002: Venta rápida con regularización pendiente`).

---

## 3. Principio de Inmutabilidad Arquitectónica no Justificada

Las decisiones marcadas como **Confirmado** en [`docs/06-gestion/DECISIONES.md`](docs/06-gestion/DECISIONES.md) son vinculantes.
- Ningún agente puede alterar la arquitectura base (p. ej. cambiar el enfoque *Offline-First*, descartar SQLite local, sustituir Supabase o asumir facturación electrónica dentro del MVP) sin:
  1. Justificación técnica o de negocio explícita.
  2. Aprobación expresa del usuario.
  3. Actualización formal del registro en `DECISIONES.md` pasando la decisión previa a `Descartado` o `Superado` y registrando la nueva decisión.

---

## 4. Mantenimiento y Sincronización Documental Activa

La documentación y el código deben evolucionar de forma atómica:

- Si se modifica una entidad o campo: actualizar [`docs/02-arquitectura/MODELO_DATOS.md`](docs/02-arquitectura/MODELO_DATOS.md) y [`docs/03-estandares/DICCIONARIO_DATOS.md`](docs/03-estandares/DICCIONARIO_DATOS.md).
- Si se modifica un flujo comercial: actualizar [`docs/01-requerimientos/SRS.md`](docs/01-requerimientos/SRS.md) y [`docs/01-requerimientos/REGLAS_NEGOCIO.md`](docs/01-requerimientos/REGLAS_NEGOCIO.md).
- Si se implementa un control de seguridad: actualizar el estado en [`docs/04-seguridad/HARDENING.md`](docs/04-seguridad/HARDENING.md).
- Todo cambio relevante debe registrarse cronológicamente en [`docs/06-gestion/CHANGELOG.md`](docs/06-gestion/CHANGELOG.md).

---

## 5. Higiene de Seguridad y Secreto Cero

1. **Prohibición absoluta de credenciales en código:** Ningún token, API key (anon o service_role), contraseña, cadena de conexión o secreto puede incluirse en el repositorio de código ni en la documentación.
2. **Manejo de variables de entorno:** Utilizar archivos `.env.example` con valores de plantilla no confidenciales.
3. **Privacidad de datos:** No generar fixtures de prueba ni ejemplos con datos personales reales de clientes o proveedores.
4. **Verificación continua de controles:** Contrastar toda nueva funcionalidad contra la matriz de seguridad en [`docs/04-seguridad/HARDENING.md`](docs/04-seguridad/HARDENING.md).

---

## 6. Notificación Proactiva de Inconsistencias y Riesgos

El agente debe mantener una postura crítica y preventiva:
- Si una especificación es ambigua o presenta vacíos lógicos (p. ej. cómo calcular diferencias en cierres de caja offline provisionales), el agente debe señalarlo explícitamente y proponer alternativas estructuradas antes de asumir una implementación arbitraria.
- Identificar y reportar riesgos de concurrencia, rendimiento en dispositivos de gama baja o pérdida de datos en sincronización asíncrona.

---

## 7. Protocolo de Verificación Previo al Cierre de Tareas

Antes de dar por concluida cualquier tarea o hito, el agente debe verificar de forma autónoma:
1. **Integridad de enlaces:** Comprobar que todos los enlaces relativos de Markdown apunten a archivos existentes.
2. **Consistencia léxica y de IDs:** Asegurar que los identificadores (`RF-xxx`, `RN-xxx`, `DEC-xxx`, etc.) sean idénticos en todos los documentos.
3. **Calidad de código (cuando aplique):** Ejecutar comprobaciones de tipos (`tsc --noEmit`), linters (`eslint`) y pruebas automatizadas (`jest`/`vitest`).
4. **Ausencia de secretos:** Escanear archivos creados o modificados en busca de credenciales accidentales.
5. **No operaciones destructivas:** No realizar commits, push o cambios en Git sin solicitud explícita del usuario.

---

## 8. Idioma y Estilo de Comunicación

- **Documentación:** Redactada íntegramente en español técnico, formal, claro y conciso.
- **Código y Nombres Técnicos:** Nombres de variables, funciones, componentes y archivos de código preferentemente en inglés o con dominio mixto justificado según [`docs/03-estandares/ESTANDAR_PROGRAMACION.md`](docs/03-estandares/ESTANDAR_PROGRAMACION.md), manteniendo la coherencia del diccionario de datos.
- **Entregables:** Cada reporte de finalización debe incluir un resumen estructurado de cambios, verificaciones, riesgos pendientes y próximos pasos recomendados.

---

## 9. Política Permanente de Versionado y Publicación en Git

A partir del hito H00.2, todo trabajo técnico o documental se rige por las siguientes normas de control de versiones:

1. **Commit Identificable por Hito:** Todo hito importante concluido debe contar con un commit atómico e identificable en Git que represente cambios reales y verificables.
2. **Publicación Obligatoria mediante Push:** Cada hito finalizado debe publicarse en el repositorio remoto (`origin`) mediante `git push`, siempre y cuando todas las verificaciones previas resulten satisfactorias.
3. **Formato Conventional Commits:** Los mensajes de commit deben seguir la especificación de *Conventional Commits*:
   - `docs(h00): inicializacion documental del proyecto`
   - `docs(h00.1): auditoria y consolidacion documental`
   - `docs(h00.2): configuracion git, politica de versionado y publicacion inicial`
   - `docs(h01): especificacion detallada de requerimientos`
   - `docs(h02): arquitectura y estrategia offline`
   - `docs(h03): modelo y diccionario de datos`
   - `docs(h04): estandares de programacion y hardening`
   - `docs(h05): planificacion tecnica y criterios de aceptacion`
   - `feat(h06): inicializacion del monorepo y persistencia local`
4. **Prohibición de Secretos y Temporales:** Queda estrictamente prohibido comitear tokens, claves de API, contraseñas, archivos `.env` reales o residuos temporales de build/pruebas.
5. **No `push --force` ni Merges Destructivos:** Queda vetado el uso de `git push --force` sobre la rama principal `master` o ramas compartidas, así como operaciones de reescritura de historial destructivas.
6. **Verificación Pre-Commit (`git diff`):** Antes de confirmar un commit, se debe inspeccionar obligatoriamente el `git diff` y ejecutar linters, verificación de tipos y comprobación de enlaces.
7. **Verificación Post-Push:** No se declarará completado ni publicado un hito sin comprobar explícitamente el estado del repositorio remoto y la respuesta afirmativa de GitHub.
8. **Evolución Atómica Código-Documentación:** Toda modificación en el código que impacte entidades, flujos comerciales, arquitectura o seguridad debe comitearse junto con la actualización de la documentación correspondiente.
9. **Estrategia de Ramas para Cambios Mayores:** Para funcionalidades complejas en fases posteriores a H06, se valorará el uso de ramas de trabajo (*feature branches*) y Pull Requests antes de su integración a la rama principal `master`.
