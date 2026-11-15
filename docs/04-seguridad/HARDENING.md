# Línea Base de Seguridad y Hardening (HARDENING.md)

**Proyecto:** Sistema de Gestión de Librería — Proyecto Tienda  
**Documento:** HARDENING.md  
**Estado:** Línea base preliminar establecida (Hito H00)  
**Trazabilidad:** [../01-requerimientos/SRS.md](../01-requerimientos/SRS.md) | [../02-arquitectura/ARQUITECTURA.md](../02-arquitectura/ARQUITECTURA.md) | [../../AGENTS.md](../../AGENTS.md)

---

## 1. Convención de Estados de Control de Seguridad

Para garantizar máxima honestidad técnica y auditoría rigurosa, cada control de seguridad se clasifica exclusivamente bajo uno de los siguientes estados:

- **Pendiente:** Control identificado y especificado, a la espera de su implementación en el hito correspondiente. *(Estado por defecto en el hito H00)*.
- **Implementado:** Control desarrollado en código o configuración de infraestructura, con evidencia comprobable en el repositorio.
- **Verificado:** Control implementado que ha superado pruebas automatizadas, pruebas de penetración o auditorías de verificación.
- **No Aplicable:** Control evaluado pero descartado de forma justificada por encontrarse fuera del alcance del sistema o del modelo de amenazas.

> [!IMPORTANT]
> En este hito documental **H00**, ningún control puede marcarse como *Implementado* o *Verificado*, ya que no se ha introducido código ejecutable ni aprovisionado infraestructura.

---

## 2. Dominios de Seguridad

### 2.1 Autenticación y Gestión de Sesiones (SEC-AUTH)
- **SEC-AUTH-001 (Autenticación delegada a Supabase GoTrue):**
  - Todo usuario operativo debe autenticarse mediante credenciales seguras gestionadas por GoTrue.
  - Los tokens de acceso (JWT) deben tener una vigencia máxima configurable y renovarse mediante *refresh tokens* seguros.
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-AUTH-002 (Almacenamiento seguro de tokens de sesión):**
  - Los tokens JWT y refresh tokens en el dispositivo Android deben persistirse obligatoriamente en el Android Keystore mediante `expo-secure-store`.
  - Queda estrictamente prohibido el uso de `AsyncStorage` o almacenamiento en texto plano para credenciales o tokens.
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-AUTH-003 (Cierre de sesión e invalidación local):**
  - El cierre de sesión debe purgar de inmediato los tokens en `expo-secure-store` y revocar la sesión activa en el servidor.
  - **Estado:** `Pendiente` (Fase objetivo: H01).

---

### 2.2 Control de Acceso y Autorización (SEC-AUTHZ)
- **SEC-AUTHZ-001 (Row Level Security - RLS en Supabase):**
  - RLS activado de forma obligatoria en el 100% de las tablas en PostgreSQL.
  - Las políticas deben validar el rol del usuario (`auth.jwt() -> app_metadata -> role`) para restringir lecturas y mutaciones.
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-AUTHZ-002 (Principio de mínimo privilegio por roles):**
  - `Vendedor`: Acceso restringido a registrar ventas, consultar catálogo y ver movimientos de su caja abierta. Sin permisos para anular ventas ni editar costos de compra de proveedores.
  - `Dueño`: Permisos de administración comercial, autorización de créditos/fiados y supervisión de caja.
  - `Administrador`: Control total de configuraciones, auditoría y gestión de cuentas.
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-AUTHZ-003 (Autorización en dos pasos para entregas con saldo):**
  - Toda venta con entrega física y saldo pendiente debe requerir la validación de credenciales (PIN o reautenticación) del Dueño o Administrador antes de consolidarse (ref: [RN-PAG-002](../01-requerimientos/REGLAS_NEGOCIO.md#rn-pag-002-autorización-obligatoria-para-entregas-con-saldo-pendiente)).
  - **Estado:** `Pendiente` (Fase objetivo: H04).

---

### 2.3 Seguridad de Datos Locales en Dispositivo (SEC-DATA)
- **SEC-DATA-001 (Cifrado de la base de datos local SQLite):**
  - La base de datos SQLite en el dispositivo Android debe evaluarse para cifrado en reposo (SQLCipher o equivalente respaldado por clave en Keystore) para mitigar extracción de datos en dispositivos comprometidos o sustraídos (ref: [DEC-015](../06-gestion/DECISIONES.md#dec-015-estrategia-de-cifrado-de-base-de-datos-local-sqlite)).
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-DATA-002 (Aislamiento de almacenamiento sandbox de la app):**
  - La base de datos SQLite y las imágenes locales en caché deben residir estrictamente en el directorio privado de datos de la aplicación (`Context.getFilesDir()`), inaccesible para otras apps en Android.
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-DATA-003 (Limpieza de archivos temporales de cámara y OCR):**
  - Las fotografías capturadas para OCR deben redimensionarse, procesarse y eliminarse de los directorios temporales tras su persistencia definitiva.
  - **Estado:** `Pendiente` (Fase objetivo: H02).

---

### 2.4 Seguridad en Almacenamiento de Archivos (SEC-STRG)
- **SEC-STRG-001 (Buckets privados en Supabase Storage):**
  - Los buckets dedicados a comprobantes de gastos (`vouchers-gastos`), fotos de ventas rápidas (`ventas-rapidas`) y portadas de libros deben crearse con visibilidad privada por defecto.
  - **Estado:** `Pendiente` (Fase objetivo: H02).
- **SEC-STRG-002 (Políticas RLS en Storage Objects):**
  - Solo usuarios autenticados con los roles pertinentes pueden subir (`INSERT`) o descargar (`SELECT`) archivos. Las descargas se gestionarán mediante URLs firmadas con tiempo de expiración corto (máx. 15 minutos).
  - **Estado:** `Pendiente` (Fase objetivo: H02).

---

### 2.5 Seguridad en Tránsito y Red (SEC-NET)
- **SEC-NET-001 (Cifrado obligatorio TLS 1.3):**
  - Todas las peticiones HTTP y conexiones WebSocket con Supabase deben cursarse bajo HTTPS con TLS 1.3 obligatorio y algoritmos criptográficos robustos.
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-NET-002 (Certificate Pinning para release de producción):**
  - Evaluar la incorporación de SSL Pinning en la aplicación Android para entornos de producción para mitigar ataques de intermediario (*Man-in-the-Middle*).
  - **Estado:** `Pendiente` (Fase objetivo: H07).

---

### 2.6 Protección de Secretos y Configuración (SEC-SECR)
- **SEC-SECR-001 (Política de Secreto Cero en Repositorio):**
  - Ninguna credencial, clave de servicio (*service_role key*), contraseña o token puede persistirse en el control de versiones.
  - Se mantendrá un archivo `.env.example` exclusivamente con nombres de variables y valores ficticios.
  - **Estado:** `Pendiente` (Fase objetivo: H00 - Verificado documentalmente).
- **SEC-SECR-002 (Aislamiento de la Service Role Key):**
  - La clave `supabase_service_role_key` jamás debe incluirse en la aplicación móvil React Native. Solo la clave pública anónima (`anon_key`) con permisos regulados por RLS puede empaquetarse en el cliente.
  - **Estado:** `Pendiente` (Fase objetivo: H01).

---

### 2.7 Auditoría, Trazabilidad y Logs (SEC-AUD)
- **SEC-AUD-001 (Inmutabilidad de registros financieros):**
  - Las transacciones de venta, pagos y movimientos de caja no deben permitir operaciones `UPDATE` o `DELETE` destructivas. Las correcciones deben registrarse mediante eventos de anulación o contra-asientos trazables.
  - **Estado:** `Pendiente` (Fase objetivo: H01).
- **SEC-AUD-002 (Bitácora de autorizaciones):**
  - El sistema debe auditar la fecha, hora, usuario autorizador y justificación de cualquier entrega con saldo pendiente (fiado) o anulación de venta.
  - **Estado:** `Pendiente` (Fase objetivo: H04).

---

### 2.8 Seguridad del Motor de Sincronización (SEC-SYNC)
- **SEC-SYNC-001 (Validación de mutaciones en el servidor):**
  - El backend en Supabase no debe aceptar mutaciones ciegas desde los clientes móviles. Debe verificar que el usuario autenticado que envía el lote de sincronización posea permisos sobre los registros afectados.
  - **Estado:** `Pendiente` (Fase objetivo: H06).
- **SEC-SYNC-002 (Prevención de ataques de repetición - Replay Protection):**
  - Cada mutación en la cola Outbox debe contener un UUID único y una marca de tiempo UTC monotónica. El servidor rechazará transacciones con identificadores duplicados ya procesados.
  - **Estado:** `Pendiente` (Fase objetivo: H06).

---

## 3. Matriz de Controles de Seguridad

| ID de Control | Dominio | Descripción Resumida | Estado Actual | Fase de Especificación | Fase de Implementación |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `SEC-AUTH-001` | Autenticación | GoTrue JWT + refresh tokens | **Pendiente** | H04 | H06 |
| `SEC-AUTH-002` | Autenticación | Almacenamiento en Keystore (`SecureStore`) | **Pendiente** | H04 | H06 |
| `SEC-AUTH-003` | Autenticación | Invalidación local y remota de sesión | **Pendiente** | H04 | H06 |
| `SEC-AUTHZ-001`| Autorización | RLS en 100% de tablas PostgreSQL | **Pendiente** | H04 | H06 |
| `SEC-AUTHZ-002`| Autorización | RBAC (Admin, Dueño, Vendedor) | **Pendiente** | H04 | H06 |
| `SEC-AUTHZ-003`| Autorización | Doble factor/PIN para autorización de fiados | **Pendiente** | H04 | H08 |
| `SEC-DATA-001` | Datos Locales| Cifrado de base de datos SQLite en reposo | **Pendiente** | H04 | H06 |
| `SEC-DATA-002` | Datos Locales| Aislamiento en sandbox de la app | **Pendiente** | H04 | H06 |
| `SEC-DATA-003` | Datos Locales| Purgado de temporales de cámara y OCR | **Pendiente** | H04 | H07 |
| `SEC-STRG-001` | Almacenamiento| Buckets privados en Supabase Storage | **Pendiente** | H04 | H07 |
| `SEC-STRG-002` | Almacenamiento| Políticas RLS y URLs firmadas de descarga | **Pendiente** | H04 | H07 |
| `SEC-NET-001`  | Red | TLS 1.3 mandatorio en toda conexión | **Pendiente** | H04 | H06 |
| `SEC-NET-002`  | Red | Certificate Pinning para Android | **Pendiente** | H04 | H12 |
| `SEC-SECR-001` | Secretos | Secreto cero en control de versiones | **Pendiente** | H00.1 | Permanente |
| `SEC-SECR-002` | Secretos | Exclusión de `service_role key` en móvil | **Pendiente** | H04 | H06 |
| `SEC-AUD-001`  | Auditoría | Inmutabilidad de registros financieros | **Pendiente** | H04 | H06 |
| `SEC-AUD-002`  | Auditoría | Bitácora de autorizaciones y anulaciones | **Pendiente** | H04 | H08 |
| `SEC-SYNC-001` | Sincronización| Validación de mutaciones en servidor | **Pendiente** | H04 | H10 |
| `SEC-SYNC-002` | Sincronización| Protección contra ataques de repetición | **Pendiente** | H04 | H10 |
