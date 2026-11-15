# Línea Base de Seguridad y Hardening (HARDENING.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda<br>
**Documento:** HARDENING.md<br>
**Estado:** Consolidado y Refinado en H04<br>
**Trazabilidad:** [../01-requerimientos/SRS.md](../01-requerimientos/SRS.md) | [../02-arquitectura/ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md) | [../02-arquitectura/MODELO_DATOS.md](../02-arquitectura/MODELO_DATOS.md) | [../06-gestion/DECISIONES.md](../06-gestion/DECISIONES.md) | [../../AGENTS.md](../../AGENTS.md)

---

## 1. Convención de Estados de Control de Seguridad

Para garantizar máxima trazabilidad técnica y rigor de auditoría, cada control de seguridad se clasifica exclusivamente bajo uno de los siguientes estados:

- **Pendiente:** Control identificado y formalmente especificado, a la espera de su implementación en el hito correspondiente. *(Estado obligatorio de todos los controles técnicos en fase de diseño documental)*.
- **Implementado:** Control desarrollado en código aplicativo, migraciones o configuración de infraestructura, con evidencia comprobable en el repositorio.
- **Verificado:** Control implementado que ha superado pruebas automatizadas de seguridad, pruebas de penetración o auditorías formales de verificación.
- **No Aplicable:** Control evaluado pero descartado de forma justificada por encontrarse fuera del alcance del sistema o del modelo de amenazas.

> [!IMPORTANT]
> En este hito documental **H04**, todos los controles técnicos se declaran en estado **Pendiente**, dado que el repositorio se mantiene exclusivamente en fase de especificación y diseño sin despliegue de código aplicativo ni aprovisionamiento de infraestructura remota.

---

## 2. Dominios de Seguridad y Especificación de Controles

### 2.1 Autenticación y Gestión de Sesiones (SEC-AUTH)
- **SEC-AUTH-001 (Autenticación delegada a Supabase GoTrue):**
  - Todo operador del sistema debe autenticarse mediante credenciales gestionadas por GoTrue.
  - Los tokens de acceso (JWT) deben tener una vigencia máxima configurable (máx. 1 hora) y renovarse mediante *refresh tokens* seguros.
- **SEC-AUTH-002 (Almacenamiento seguro de tokens de sesión):**
  - Los tokens JWT y refresh tokens en el dispositivo Android deben persistirse obligatoriamente en el Android Keystore mediante `expo-secure-store`.
  - Queda estrictamente vetado el uso de `AsyncStorage` o almacenamiento en texto plano para credenciales, PINs o tokens.
- **SEC-AUTH-003 (Cierre de sesión e invalidación local y remota):**
  - El cierre de sesión purga inmediatamente las claves en `expo-secure-store` e invoca la revocación remota de la sesión en GoTrue.

### 2.2 Control de Acceso y Autorización (SEC-AUTHZ)
- **SEC-AUTHZ-001 (Row Level Security - RLS en PostgreSQL):**
  - RLS activado de forma obligatoria en el 100% de las tablas alojadas en PostgreSQL (Supabase).
  - Las políticas de seguridad deben evaluar el rol del usuario (`auth.jwt() -> app_metadata -> role`) para restringir consultas (`SELECT`) y mutaciones (`INSERT`, `UPDATE`).
- **SEC-AUTHZ-002 (Principio de mínimo privilegio por roles):**
  - `Vendedor`: Restringido a registrar ventas, consultar catálogo bibliográfico y operar su turno de caja abierto. Bloqueado para anular ventas, ver costos de proveedores o modificar precios.
  - `Dueño`: Facultades comerciales completas, autorización de fiados, supervisión de turnos de caja y consulta de costos de adquisición.
  - `Administrador`: Control total del sistema, gestión de cuentas de usuario, asignación de roles y conciliación de diferencias de caja.
- **SEC-AUTHZ-003 (Autorización en dos pasos para entregas con saldo pendiente):**
  - Toda venta con entrega física y saldo pendiente (fiado) exige obligatoriamente la validación de credenciales (PIN o reautenticación) del Dueño o Administrador ([RN-PAG-002](../01-requerimientos/REGLAS_NEGOCIO.md#rn-pag-002-autorización-obligatoria-para-entregas-con-saldo-pendiente)).
- **SEC-AUTHZ-004 (Autorización offline de operaciones sensibles, revocación y auditoría):**
  - Las autorizaciones offline de supervisores (aprobación de fiados, descuentos excepcionales o anulaciones) operan contra credenciales en caché local cifrada con caducidad máxima (propuesta: 7 días).
  - Obligatoriedad de sincronizar la Lista de Revocación Local (Local CRL) al recuperar conectividad.
  - Registro inmutable en auditoría (`autorizador_id`, `dispositivo_id`, `timestamp_local`, firma HMAC) que el servidor valida antes de consolidar la mutación.

### 2.3 Seguridad de Datos Locales en Dispositivo (SEC-DATA)
- **SEC-DATA-001 (Cifrado local de datos sensibles y análisis DEC-015):**
  - Conforme al análisis arquitectónico de [DEC-015](../06-gestion/DECISIONES.md#dec-015-estrategia-de-cifrado-de-base-de-datos-local-sqlite), se evalúa la alternativa de *Cifrado Híbrido por Campos* frente a *SQLCipher*:
    - *SQLCipher:* Ofrece cifrado de página completa pero introduce sobrecarga de rendimiento I/O en hardware modesto, riesgo de corrupción irrecuperable ante fallo del Keystore y complejidad de compilación nativa en Expo.
    - *Cifrado por Campos con AES-256-GCM:* La base de datos SQLite aprovecha el cifrado de almacenamiento del sistema operativo Android (File-Based Encryption - FBE) dentro del sandbox privado; los campos de alta confidencialidad (números de cuenta bancaria de proveedores `numero_cuenta_cifrado`, PINs y hashes de sesión) se cifran a nivel de aplicación con AES-256-GCM utilizando claves generadas y resguardadas en el Android Keystore (`expo-secure-store`).
  - *Ciclo de Vida de Claves:*
    - *Generación:* Clave maestra AES de 256 bits generada por hardware en Android Keystore en la primera inicialización de la app.
    - *Rotación:* Al renovar credenciales o cada 90 días, los campos sensibles se recifran con una nueva clave derivada, retirando la clave anterior tras validar la reescritura.
    - *Recuperación:* Ante pérdida de clave local o reinstalación del dispositivo, los datos sensibles maestros se restauran mediante re-sincronización autenticada desde Supabase, evitando la pérdida catastrófica de base de datos asociada a SQLCipher.
- **SEC-DATA-002 (Aislamiento de almacenamiento sandbox de la aplicación):**
  - La base de datos SQLite y las imágenes en caché deben ubicarse estrictamente en el directorio privado de la aplicación (`Context.getFilesDir()`), bloqueado para aplicaciones externas sin privilegios root.
- **SEC-DATA-003 (Limpieza de archivos temporales de cámara y OCR):**
  - Las fotografías capturadas para reconocimiento OCR o soporte de gastos deben redimensionarse, procesarse y eliminarse de las carpetas temporales (`cache/`) inmediatamente tras persistirse en almacenamiento seguro.

### 2.4 Seguridad en Almacenamiento de Archivos (SEC-STRG)
- **SEC-STRG-001 (Buckets privados en Supabase Storage):**
  - Los buckets para comprobantes de gastos (`expense-vouchers`), fotos de ventas rápidas (`sales-quick-photos`) y recepciones de proveedores deben crearse con visibilidad privada por defecto.
- **SEC-STRG-002 (Políticas RLS en Storage Objects y URLs firmadas):**
  - La subida y descarga de objetos multimedia exige autenticación y rol autorizado.
  - La descarga de imágenes sensibles se realiza exclusivamente mediante URLs firmadas con expiración máxima de 15 minutos.

### 2.5 Seguridad en Tránsito y Red (SEC-NET)
- **SEC-NET-001 (Cifrado obligatorio TLS 1.3):**
  - Todo tráfico HTTP y WebSocket entre los terminales móviles y Supabase se cursa bajo TLS 1.3 con suites criptográficas modernas.
- **SEC-NET-002 (Certificate Pinning para release de producción):**
  - Evaluar la incorporación de SSL Pinning en la compilación de producción de la app Android para mitigar ataques de intermediario (*Man-in-the-Middle*) en redes Wi-Fi públicas.

### 2.6 Protección de Secretos y Configuración (SEC-SECR)
- **SEC-SECR-001 (Política de Secreto Cero en Repositorio):**
  - Prohibición absoluta de incluir API keys reales, tokens de servicio, contraseñas o credenciales en el control de versiones.
  - El repositorio solo mantendrá archivos de plantilla `.env.example` con valores ficticios.
- **SEC-SECR-002 (Aislamiento absoluto de la Service Role Key):**
  - La clave `supabase_service_role_key` jamás debe incluirse ni compilarse en la aplicación móvil React Native. Solo la clave pública anónima (`anon_key`) con permisos restringidos por RLS puede empaquetarse en el cliente.

### 2.7 Auditoría, Trazabilidad y Logs (SEC-AUD)
- **SEC-AUD-001 (Inmutabilidad de registros financieros):**
  - Las tablas de transacciones financieras (`ventas`, `pagos_venta`, `movimientos_caja`, `abonos_proveedor`) operan bajo un modelo estrictamente *append-only*.
  - Prohibición de sentencias destructivas (`UPDATE`/`DELETE`) sobre importes o medios de pago.
- **SEC-AUD-002 (Bitácora inmutable de autorizaciones):**
  - El sistema registra en la tabla `auditoria_financiera` fecha, hora UTC, terminal emisor, supervisor autorizador, motivo y snapshot de datos para toda anulación o entrega con saldo pendiente.

### 2.8 Seguridad del Motor de Sincronización (SEC-SYNC)
- **SEC-SYNC-001 (Validación estricta de mutaciones en el servidor):**
  - Supabase valida la autenticidad, pertenencia de rol y congruencia lógica de cada mutación recibida desde la cola outbox móvil antes de aceptarla en la base de datos central.
- **SEC-SYNC-002 (Prevención de ataques de repetición e idempotencia):**
  - Toda mutación financiera incluye una clave de idempotencia `idempotency_key` (hash SHA-256 compuesto). El servidor descarta de forma segura reintentos de red ya procesados sin duplicar cobros ni asientos.
- **SEC-SYNC-003 (Mínimo privilegio y seguridad en funciones RPC de Supabase):**
  - Las funciones RPC en PostgreSQL deben priorizar `SECURITY INVOKER`. Si requieren `SECURITY DEFINER` para registrar en `sync_processed_mutations` o `auditoria_financiera`, deben fijar obligatoriamente `SET search_path = public, pg_temp;`, verificar `auth.uid() IS NOT NULL`, validar roles y revocar privilegios de ejecución a `PUBLIC`.

### 2.9 Validación y Sanitización de Entradas (SEC-INP)
- **SEC-INP-001 (Validación con esquemas Zod y sanitización):**
  - Todas las entradas de datos en cliente y servidor deben validarse mediante esquemas tipados Zod, aplicando límites de longitud, formatos de texto y rangos numéricos para prevenir inyecciones SQL, desbordes y caracteres anómalos.

---

## 3. Matriz de Controles de Seguridad

| ID | Control | Riesgo | Verificación | Estado |
| :--- | :--- | :--- | :--- | :---: |
| `SEC-AUTH-001` | Autenticación GoTrue con JWT y refresh tokens seguros | Suplantación de identidad y secuestro de sesiones operativas | Inspección de configuración GoTrue y expiración de tokens | **Pendiente** |
| `SEC-AUTH-002` | Persistencia de tokens exclusivamente en Android Keystore | Extracción de tokens en dispositivos sustraídos | Inspección de código (`expo-secure-store`) y ausencia de `AsyncStorage` | **Pendiente** |
| `SEC-AUTH-003` | Purgado local y revocación remota en cierre de sesión | Reutilización indebida de sesiones inactivas | Prueba de revocación y verificación de purgado en Keystore | **Pendiente** |
| `SEC-AUTHZ-001` | Activación de RLS en el 100% de tablas PostgreSQL | Fuga de información o mutaciones no autorizadas vía API directa | Script automatizado que audite `relrowsecurity = true` en todas las tablas | **Pendiente** |
| `SEC-AUTHZ-002` | Control de acceso basado en roles (Admin, Dueño, Vendedor) | Escalación de privilegios y operaciones financieras no autorizadas | Pruebas de integración intentando mutaciones restringidas por rol | **Pendiente** |
| `SEC-AUTHZ-003` | Autorización en dos pasos con PIN para entregas con saldo | Otorgamiento discrecional o fraudulento de crédito (fiado) | Prueba unitaria y de flujo: bloqueo de fiado sin firma de supervisor | **Pendiente** |
| `SEC-AUTHZ-004` | Autorización offline con caducidad, lista CRL y firma HMAC | Fraude con supervisores dados de baja en terminales desconectados | Prueba de rechazo de autorización con supervisor en lista CRL | **Pendiente** |
| `SEC-DATA-001` | Cifrado AES-256 de campos bancarios y sensibles (DEC-015) | Acceso a números de cuenta bancaria ante sustracción o rooteo | Inspección de base de datos SQLite verificando texto cifrado | **Pendiente** |
| `SEC-DATA-002` | Aislamiento de SQLite e imágenes en sandbox de la app | Acceso o manipulación de datos locales por otras apps instaladas | Auditoría de rutas verificando uso exclusivo de `Context.getFilesDir()` | **Pendiente** |
| `SEC-DATA-003` | Purgado automático de archivos temporales de cámara y OCR | Fuga de imágenes transitorias o agotamiento de almacenamiento | Verificación de eliminación de archivos en carpeta `cache/` tras proceso | **Pendiente** |
| `SEC-STRG-001` | Visibilidad estrictamente privada en buckets de Storage | Acceso público o indexación no autorizada de comprobantes y fotos | Auditoría de metadatos de buckets en Supabase Storage (`public = false`) | **Pendiente** |
| `SEC-STRG-002` | Descarga de archivos mediante URLs firmadas de corta vigencia | Enlace perpetuo a comprobantes financieros confidenciales | Validación de cabeceras de expiración en URLs generadas (máx. 15 min) | **Pendiente** |
| `SEC-NET-001` | Transporte cifrado mandatorio TLS 1.3 en HTTPS y WebSocket | Interceptación de credenciales y datos en tránsito | Análisis de tráfico de red y rechazo de versiones TLS inferiores | **Pendiente** |
| `SEC-NET-002` | Certificate Pinning en compilación de producción Android | Ataques de intermediario (MitM) en redes locales comprometidas | Prueba de interceptación con proxy HTTP en compilación release | **Pendiente** |
| `SEC-SECR-001` | Política de Secreto Cero en repositorio de código | Exposición de credenciales, tokens de servicio o contraseñas | Escáner automatizado de secretos en commits y verificación de `.env.example` | **Pendiente** |
| `SEC-SECR-002` | Exclusión absoluta de `service_role key` en la app móvil | Compromiso total del backend si la app cliente es descompilada | Análisis estático de binario APK buscando cadenas `service_role` | **Pendiente** |
| `SEC-AUD-001` | Inmutabilidad de ledgers financieros (modelo append-only) | Alteración o borrado de transacciones de venta o pagos | Pruebas de ejecución de sentencias `UPDATE`/`DELETE` rechazadas por BD | **Pendiente** |
| `SEC-AUD-002` | Bitácora forense de autorizaciones y anulaciones | Falta de trazabilidad ante discrepancias de dinero o mercadería | Comprobación de inserción en `auditoria_financiera` ante cada evento | **Pendiente** |
| `SEC-SYNC-001` | Validación de permisos y congruencia en mutaciones outbox | Inyección de mutaciones manipuladas desde terminales comprometidos | Pruebas de envío de mutaciones falsificadas esperando rechazo 403/422 | **Pendiente** |
| `SEC-SYNC-002` | Deduplicación e idempotencia por hash SHA-256 | Duplicación accidental de cobros o asientos por reintentos de red | Prueba de envío repetido del mismo `idempotency_key` con respuesta idempotente | **Pendiente** |
| `SEC-SYNC-003` | Seguridad estricta en RPCs (`search_path`, roles, no PUBLIC) | Inyección SQL o escalación de privilegios en funciones Postgres | Auditoría de DDL de funciones RPC y revocación de permisos a `PUBLIC` | **Pendiente** |
| `SEC-INP-001` | Validación estricta con esquemas Zod en todas las entradas | Inyección SQL, datos malformados o inconsistencia de tipos | Pruebas unitarias de validación con inputs maliciosos o truncados | **Pendiente** |
